require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const store = require('./db/database');
const { commands, execute, norm } = require('./commands');
const { doAction, record } = require('./services/moderation');

const required=['DISCORD_TOKEN','CLIENT_ID'];
for(const key of required) if(!process.env[key]) throw new Error(`Missing ${key}; copy .env.example to .env and configure it.`);
if(!process.env.MONGODB_URI) throw new Error('Missing MONGODB_URI; configure a MongoDB Atlas or Railway database connection string.');
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildVoiceStates],partials:[Partials.Channel]});
const log=(level,message,details={})=>console.log(JSON.stringify({time:new Date().toISOString(),level,message,...details}));
const starts=new Map();
const voiceSessions=new Map();
client.once(Events.ClientReady,c=>{c.user.setPresence({activities:[{name:process.env.ACTIVITY_TEXT||'DN Development Team',type:0}],status:'online'});log('info',`Ready as ${c.user.tag}`);});
client.on(Events.InteractionCreate,async i=>{
 try {
  if(i.isChatInputCommand()) return await execute(i);
  if(i.isButton()&&i.customId==='cancel') return i.update({content:'Action cancelled.',components:[]});
  if(i.isButton()&&i.customId.startsWith('confirm:')) {
   const [,kind,targetId,ownerId]=i.customId.split(':');
   if(i.user.id!==ownerId)return i.reply({content:'Only the moderator who opened this confirmation can use it.',ephemeral:true});
   const target=await i.guild.members.fetch(targetId); await doAction(i,kind,target,'Confirmed moderation action',0);
   return i.update({content:`${kind} completed for <@${targetId}>.`,components:[]});
  }
 } catch(e) {log('error','Interaction failed',{error:e.message,command:i.commandName}); const msg=e.code===50013?'I lack a required permission.':(e.message||'Something went wrong.'); if(i.deferred||i.replied) await i.followUp({content:msg,ephemeral:true}).catch(()=>{}); else await i.reply({content:msg,ephemeral:true}).catch(()=>{});}
});
client.on(Events.GuildMemberAdd,async member=>{
 try{
  const s=await store.settings(member.guild.id); const prior=await store.getMember(member.guild.id,member.id);
  let num=prior?.member_number;
  if(!prior){num=s.member_numbering?await store.nextMemberNumber(member.guild.id):null; await store.ensureMember(member.guild.id,member.id,num);}
  if(s.welcome_channel){const channel=member.guild.channels.cache.get(s.welcome_channel); if(channel?.isTextBased()) await channel.send({embeds:[new EmbedBuilder().setColor(s.welcome_color).setDescription(s.welcome_message.replaceAll('{user}',`<@${member.id}>`).replaceAll('{server}',member.guild.name).replaceAll('{number}',String(num||''))).setThumbnail(member.user.displayAvatarURL()).setTimestamp()]});}
  if(s.welcome_role){const role=member.guild.roles.cache.get(s.welcome_role);if(role&&role.position<member.guild.members.me.roles.highest.position)await member.roles.add(role).catch(e=>log('warn','Welcome role assignment failed',{guild:member.guild.id,error:e.message}));}
 }catch(e){log('error','Welcome handler failed',{error:e.message});}
});
client.on(Events.MessageCreate,async message=>{
 if(!message.guild||message.author.bot)return;
 try{
  const s=await store.settings(message.guild.id); const now=Date.now();
  if(s.analytics_enabled){const date=new Date().toISOString().slice(0,10),hour=new Date().getUTCHours();await store.incrementActivity(message.guild.id,date,hour,'messages',1);}
  if(s.leveling_enabled){const gained=5+Math.floor(Math.random()*8);await store.awardTextXp(message.guild.id,message.author.id,now,gained);}
  if(s.filter_enabled){const text=norm(message.content);const terms=(s.filter_words||[]).map(norm),exceptions=(s.filter_exceptions||[]).map(norm);if(!exceptions.some(x=>x&&text.includes(x))&&terms.some(x=>x&&text.includes(x))){if(s.filter_action==='delete')await message.delete().catch(()=>{});const logCh=message.guild.channels.cache.find(ch=>ch.name==='mod-logs'&&ch.isTextBased());if(logCh)await logCh.send({embeds:[new EmbedBuilder().setTitle('Possible filtered content').setDescription(`Message by <@${message.author.id}> in <#${message.channelId}> ${s.filter_action==='delete'?'(deleted)':''}.`).setFooter({text:'Review manually; filters can produce false positives.'}).setTimestamp()]});}}
  if(s.conversation_enabled&&Math.random()<0.015&&/\bhow are you\b|كيف حالك/i.test(message.content)){const last=starts.get(message.guild.id)||0;if(now-last>300000){starts.set(message.guild.id,now);await message.reply('I’m doing well, thanks for asking!').catch(()=>{});}}
 }catch(e){log('error','Message handler failed',{guild:message.guildId,error:e.message});}
});
async function closeVoiceSessions(channel, now) {
 if(!channel) return;
 for(const [key, session] of voiceSessions) {
  if(session.channelId!==channel.id) continue;
  const started=session.started;
  const mins=Math.floor((now-started)/60000), s=await store.settings(channel.guild.id);
  if(s.analytics_enabled&&mins>0){const date=new Date(started).toISOString().slice(0,10),hour=new Date(started).getUTCHours();await store.incrementActivity(channel.guild.id,date,hour,'voice_minutes',mins);}
  voiceSessions.delete(key);
 }
}
function openVoiceSessions(channel, now) {
 if(!channel||channel.members.filter(m=>!m.user.bot).size<2) return;
 for(const member of channel.members.values()) if(!member.user.bot) voiceSessions.set(`${channel.guild.id}:${member.id}`,{started:now,channelId:channel.id});
}
client.on(Events.VoiceStateUpdate,async(oldState,newState)=>{
 const now=Date.now();
 if(oldState.channelId) await closeVoiceSessions(oldState.channel,now);
 if(newState.channelId&&newState.channelId!==oldState.channelId) await closeVoiceSessions(newState.channel,now);
 if(oldState.channelId) openVoiceSessions(oldState.channel,now);
 if(newState.channelId) openVoiceSessions(newState.channel,now);
});
client.on(Events.GuildCreate,g=>store.settings(g.id).catch(e=>log('error','Failed to initialize guild settings',{guild:g.id,error:e.message})));
client.on(Events.Error,e=>log('error','Discord client error',{error:e.message}));
process.on('unhandledRejection',e=>log('error','Unhandled rejection',{error:String(e)}));
process.on('SIGINT',async()=>{log('info','Shutting down');client.destroy();await store.close();process.exit(0);});
store.connect(process.env.MONGODB_URI,process.env.MONGODB_DATABASE).then(()=>client.login(process.env.DISCORD_TOKEN)).catch(e=>{log('error','Could not connect to MongoDB',{error:e.message});process.exit(1);});

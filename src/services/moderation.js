const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { recordAction } = require('../db/database');

const record = recordAction;
function hierarchy(interaction, member) {
  if (!member) throw new Error('That member is not in this server.');
  if (member.id === interaction.guild.ownerId) throw new Error('The server owner cannot be moderated.');
  if (member.id === interaction.user.id) throw new Error('You cannot use this action on yourself.');
  const botOwner = interaction.user.id === (process.env.DISCORD_OWNER_ID || '1094063045866684496');
  if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId && !botOwner) throw new Error('Your highest role must be above the target member.');
  if (member.roles.highest.position >= interaction.guild.members.me.roles.highest.position) throw new Error('My highest role must be above the target member.');
}
async function doAction(i, kind, member, reason, duration) {
  hierarchy(i, member);
  const perms = { ban: PermissionFlagsBits.BanMembers, kick: PermissionFlagsBits.KickMembers, timeout: PermissionFlagsBits.ModerateMembers }[kind];
  if (!i.memberPermissions.has(perms) && i.user.id !== (process.env.DISCORD_OWNER_ID || '1094063045866684496')) throw new Error('You do not have the required server permission.');
  if (!member.moderatable && kind === 'timeout' || !member.kickable && kind === 'kick' || !member.bannable && kind === 'ban') throw new Error(`I cannot ${kind} this member; check my permissions and role position.`);
  if (kind === 'timeout') await member.timeout(duration * 60_000, reason);
  else if (kind === 'kick') await member.kick(reason);
  else await member.ban({ reason });
  await record(i.guildId, member.id, i.user.id, kind, reason);
}
function actionEmbed(title, color=0x5865F2) { return new EmbedBuilder().setTitle(title).setColor(color).setTimestamp(); }
module.exports = { record, hierarchy, doAction, actionEmbed };

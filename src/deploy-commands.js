require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { commands } = require('./commands');
if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) throw new Error('Set DISCORD_TOKEN and CLIENT_ID in .env');
new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN).put(Routes.applicationCommands(process.env.CLIENT_ID),{body:commands}).then(()=>console.log(`Registered ${commands.length} global commands.`)).catch(err=>{console.error(err);process.exitCode=1;});

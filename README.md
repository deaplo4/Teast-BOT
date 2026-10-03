# Deaplo Discord Manager

A Discord moderation and server management bot by **Deaplo**, built with Node.js, discord.js v14, and MongoDB. Guild settings, member records, moderation history, warnings, and analytics use MongoDB collections with `guild_id` scoped queries.

## Deploy from GitHub to Railway

### 1. Create MongoDB

Create a MongoDB Atlas cluster (or another reachable MongoDB deployment), create a database user, and allow Railway's outbound network access in your database network settings. Copy the driver connection string. Keep the password URL-encoded if it contains special characters.

### 2. Upload this project to GitHub

Upload the project files to a GitHub repository. Do not upload `.env`, bot tokens, MongoDB passwords, `node_modules`, or database backups. `.gitignore` excludes `.env` and dependencies.

### 3. Create the Railway service

In Railway, create a project and deploy from the GitHub repository. Railway detects Node.js and uses `npm install` and `npm start`; `railway.json` also defines the worker start command and restart policy. This is a background bot worker and does not need a web port or health-check endpoint.

In the Railway service's **Variables** panel, add:

| Variable | Value |
| --- | --- |
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal |
| `CLIENT_ID` | Discord application ID |
| `DISCORD_OWNER_ID` | `1094063045866684496` (or your chosen owner ID) |
| `MONGODB_URI` | MongoDB driver connection string |
| `ACTIVITY_TEXT` | Optional; defaults to `DN Development Team` |

Save variables and deploy/redeploy. Railway keeps the bot online and restarts it after a crash. Slash commands must be registered once after publishing code: run `npm run commands:deploy` locally with `DISCORD_TOKEN` and `CLIENT_ID` set in your local `.env`. Global Discord command updates may take time to appear.

## Discord application setup

1. Create an application and bot in the Discord Developer Portal.
2. Enable **Server Members Intent** (welcome and member handling) and **Message Content Intent** (word filtering and conversational replies). Guild voice state events support aggregate voice activity.
3. Invite using OAuth2 scopes `bot` and `applications.commands`.
4. Grant only enabled features' permissions: View Channels, Send Messages, Embed Links, Read Message History, Manage Messages (purge/filter deletion), Moderate Members (timeouts), Kick Members, Ban Members, Manage Channels (slowmode), and Manage Roles (optional welcome role assignment). Put the bot's top role above members and roles it must act on.

## Commands

- Moderation: `/warn`, `/timeout`, `/kick`, `/ban`, `/purge`, `/slowmode`, `/modlog`.
- Server setup: `/config`, `/welcome-test`, `/analytics`.
- Utility: `/member`, `/announce`, `/help`.
- Destructive kick/ban actions require a confirmation button. Private command results are ephemeral. The configured bot owner ID can use protected commands across servers; Discord and bot role hierarchy still limits what actions the bot itself can perform.

`/config` supports welcome channel/message, filter enable/action/terms, analytics, conversational replies, text leveling, and member numbering. Most optional features start disabled. The Arabic/English filter normalizes several common Arabic spelling variants and diacritics; it is heuristic and can produce false positives. Begin with flag-only mode and review moderator logs before enabling deletion.

## Privacy and storage

MongoDB collections are `guild_settings`, `members`, `mod_actions`, `warnings`, `activity_hourly`, and `counters`. Every guild-owned record includes a server ID, and queries scope data to that server. Analytics store hourly aggregate counts only; they do not retain message content. `/member` only looks up a member in the server where it runs. The bot does not perform unrelated-server lookup or unsolicited DMs.

The schema includes a configurable retention field, but automatic retention cleanup and a deletion command are not implemented yet. Back up MongoDB using Atlas or your MongoDB provider's backup tools. Protect the database user with least privilege and do not share its credentials.

## Local run

Install Node.js 20.11+, copy `.env.example` to `.env`, fill in Discord and MongoDB values, then run:

```sh
npm install
npm run commands:deploy
npm start
```

## Current feature boundaries

Text XP is granted with a per-member cooldown. Voice XP, level roles, configurable XP rates, and a leaderboard are not implemented. Member numbers are assigned to members who join while numbering is enabled; existing members are not backfilled. Welcome role is stored but not exposed in setup commands. The bot uses MongoDB's unique indexes for server/member and hourly analytics isolation. Review and test configuration in a private server before inviting it widely.

## Files

```text
src/commands/index.js       Slash command definitions and handlers
src/db/database.js          MongoDB connection, indexes, and data helpers
src/services/moderation.js  Permission/hierarchy checks and audit records
src/deploy-commands.js      Discord slash command registration
src/index.js                Startup and Discord event handlers
railway.json                Railway worker deployment settings
Procfile                    Worker process declaration
```

## License

MIT. Authored by Deaplo.

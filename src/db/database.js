const { MongoClient } = require('mongodb');

let client;
let database;
const defaults = {
 welcome_channel: null, welcome_message: 'Welcome {user} to **{server}**!', welcome_color: '#5865F2', welcome_role: null,
 filter_action: 'flag', filter_enabled: false, filter_words: [], filter_exceptions: [],
 conversation_enabled: false, analytics_enabled: false, retention_days: 90,
 leveling_enabled: false, text_xp_min: 5, text_xp_max: 12, level_channel: null, member_numbering: false
};
async function connect(uri, name) {
 client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
 await client.connect();
 database = client.db(name || undefined);
 await Promise.all([
  database.collection('guild_settings').createIndex({ guild_id: 1 }, { unique: true }),
  database.collection('members').createIndex({ guild_id: 1, user_id: 1 }, { unique: true }),
  database.collection('mod_actions').createIndex({ guild_id: 1, created_at: -1 }),
  database.collection('activity_hourly').createIndex({ guild_id: 1, day: 1, hour: 1 }, { unique: true }),
  database.collection('warnings').createIndex({ guild_id: 1, user_id: 1 })
 ]);
 return database;
}
function col(name) { if (!database) throw new Error('MongoDB is not connected'); return database.collection(name); }
async function settings(guildId) {
 await col('guild_settings').updateOne({ guild_id: guildId }, { $setOnInsert: { guild_id: guildId, ...defaults, created_at: new Date() } }, { upsert: true });
 return col('guild_settings').findOne({ guild_id: guildId });
}
async function updateSettings(guildId, values) {
 await settings(guildId);
 await col('guild_settings').updateOne({ guild_id: guildId }, { $set: values });
}
async function recordAction(guildId, targetId, moderatorId, action, reason) {
 await col('mod_actions').insertOne({ guild_id: guildId, target_id: targetId, moderator_id: moderatorId, action, reason: reason || 'No reason provided', created_at: new Date() });
}
async function addWarning(guildId, userId, moderatorId, reason) {
 await col('warnings').insertOne({ guild_id: guildId, user_id: userId, moderator_id: moderatorId, reason, created_at: new Date() });
}
async function recentActions(guildId, targetId) {
 const query = { guild_id: guildId }; if (targetId) query.target_id = targetId;
 return col('mod_actions').find(query).sort({ _id: -1 }).limit(10).toArray();
}
async function incrementActivity(guildId, day, hour, field, amount = 1) {
 await col('activity_hourly').updateOne({ guild_id: guildId, day, hour }, { $setOnInsert: { guild_id: guildId, day, hour }, $inc: { [field]: amount } }, { upsert: true });
}
async function activitySummary(guildId, sinceDay) {
 const rows = await col('activity_hourly').aggregate([{ $match: { guild_id: guildId, day: { $gte: sinceDay } } }, { $group: { _id: null, messages: { $sum: '$messages' }, voice: { $sum: '$voice_minutes' } } }]).toArray();
 return rows[0] || { messages: 0, voice: 0 };
}
async function getMember(guildId, userId) { return col('members').findOne({ guild_id: guildId, user_id: userId }); }
async function ensureMember(guildId, userId, memberNumber = null) {
 await col('members').updateOne({ guild_id: guildId, user_id: userId }, { $setOnInsert: { guild_id: guildId, user_id: userId, member_number: memberNumber, xp: 0, last_xp_at: 0 } }, { upsert: true });
 return getMember(guildId, userId);
}
async function nextMemberNumber(guildId) {
 const result = await col('counters').findOneAndUpdate({ _id: `member:${guildId}` }, { $inc: { value: 1 } }, { upsert: true, returnDocument: 'after' });
 return result.value ?? result;
}
async function awardTextXp(guildId, userId, now, xp) {
 const result = await col('members').updateOne({ guild_id: guildId, user_id: userId, $or: [{ last_xp_at: { $lte: now - 60000 } }, { last_xp_at: { $exists: false } }] }, { $inc: { xp }, $set: { last_xp_at: now } });
 if (result.matchedCount) return true;
 await ensureMember(guildId, userId);
 return false;
}
async function close() { if (client) await client.close(); }
module.exports = { connect, close, settings, updateSettings, recordAction, addWarning, recentActions, incrementActivity, activitySummary, getMember, ensureMember, nextMemberNumber, awardTextXp };

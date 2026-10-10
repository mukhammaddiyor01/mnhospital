const mongoose = require('mongoose');
if (process.argv[2] && !process.argv[2].startsWith('--')) require('dotenv').config({ path: process.argv[2], override: true });
(async () => {
 const uri = process.env.NODE_ENV === 'production' ? process.env.MONGO_PROD : process.env.MONGO_DEV;
 if (!uri) throw new Error('Configured MongoDB URI is required');
 await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
 try {
  const db = mongoose.connection.db;
  if (db.databaseName !== 'MNHospital') throw new Error('Unexpected database');
  const views = db.collection('views');
  const duplicates = await views.aggregate([
   { $group: { _id: { memberId: '$memberId', viewRefId: '$viewRefId', viewGroup: '$viewGroup' }, count: { $sum: 1 } } },
   { $match: { count: { $gt: 1 } } }, { $limit: 1 },
  ]).toArray();
  if (duplicates.length) throw new Error('Duplicate view pairs need review before creating this index');
  if (process.argv.includes('--apply')) {
   await views.createIndex({ memberId: 1, viewRefId: 1, viewGroup: 1 }, { unique: true, name: 'view_actor_target_unique' });
   console.log('Unique view pair protection is present. No view records were changed.');
  } else console.log('No duplicate view pairs. Use --apply to ensure the unique index.');
 } finally { await mongoose.disconnect(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });

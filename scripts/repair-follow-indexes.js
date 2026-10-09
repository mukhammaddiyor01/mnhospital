const mongoose = require('mongoose');

const currentKey = { followingId: 1, followerId: 1 };
const currentName = 'followingId_1_followerId_1';
const legacyKey = { followingMemberId: 1, followerMemberId: 1 };
const legacyName = 'followingMemberId_1_followerMemberId_1';

function sameKey(actual, expected) {
	return JSON.stringify(actual) === JSON.stringify(expected);
}

async function repairFollowIndexes(follows, { apply = false, log = console.log } = {}) {
	const indexes = await follows.indexes();
	const legacy = indexes.find((index) => index.name === legacyName);
	const current = indexes.find((index) => sameKey(index.key, currentKey));
	if (legacy && (!sameKey(legacy.key, legacyKey) || legacy.unique !== true)) {
		throw new Error(`Unexpected index definition: ${legacyName}`);
	}
	if (current && (current.unique !== true || current.sparse || current.partialFilterExpression)) {
		throw new Error(`Unexpected index definition: ${current.name}`);
	}

	// Never remove legacy protection while records still depend on legacy fields.
	const invalid = await follows.countDocuments({
		$or: [
			{ followingId: { $not: { $type: 'objectId' } } },
			{ followerId: { $not: { $type: 'objectId' } } },
			{ followingMemberId: { $exists: true } },
			{ followerMemberId: { $exists: true } },
		],
	});
	if (invalid) throw new Error(`${invalid} follows require a data migration before repairing indexes`);

	if (!current) {
		const duplicates = await follows.aggregate([
			{ $group: { _id: { followingId: '$followingId', followerId: '$followerId' }, count: { $sum: 1 } } },
			{ $match: { count: { $gt: 1 } } },
			{ $limit: 1 },
		]).toArray();
		if (duplicates.length) throw new Error('Duplicate follow pairs require a data migration before repairing indexes');
		log(`${currentName}: ${apply ? 'creating' : 'would create'} unique index`);
		if (apply) await follows.createIndex(currentKey, { name: currentName, unique: true });
	} else {
		log(`${current.name}: unique pair protection already present`);
	}

	if (legacy) {
		log(`${legacyName}: ${apply ? 'removing' : 'would remove'} obsolete unique index`);
		if (apply) await follows.dropIndex(legacyName);
	} else {
		log(`${legacyName}: already absent`);
	}
}

async function main() {
	const uri = process.env.NODE_ENV === 'production' ? process.env.MONGO_PROD : process.env.MONGO_DEV;
	if (!uri) throw new Error('Configured MongoDB URI is required');
	await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
	try {
		const database = mongoose.connection.db;
		if (database.databaseName !== 'MNHospital') throw new Error(`Unexpected database: ${database.databaseName}`);
		await repairFollowIndexes(database.collection('follows'), { apply: process.argv.includes('--apply') });
	} finally {
		await mongoose.disconnect();
	}
}

module.exports = { repairFollowIndexes };

if (require.main === module) {
	main().catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
}

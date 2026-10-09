import { Connection, createConnection, Model, Types } from 'mongoose';
import FollowSchema from '../src/components/follow/schema/Follow.model';

const { repairFollowIndexes } = require('../../../scripts/repair-follow-indexes');

// Uses an isolated database only; never writes to the application's follows collection.
const persistence = process.env.MN_FOLLOW_TEST_URI ? describe : describe.skip;
persistence('Follow index repair with real Mongo persistence', () => {
	jest.setTimeout(60000);
	const databaseName = `mn_follow_${new Types.ObjectId()}`;
	let connection: Connection;
	let follows: Model<any>;

	beforeAll(async () => {
		connection = await createConnection(process.env.MN_FOLLOW_TEST_URI, {
			dbName: databaseName,
			serverSelectionTimeoutMS: 10000,
		}).asPromise();
		follows = connection.model('Follow', FollowSchema);
		await follows.init();
		await follows.collection.createIndex(
			{ followingMemberId: 1, followerMemberId: 1 },
			{ unique: true, name: 'followingMemberId_1_followerMemberId_1' },
		);
	});

	afterAll(async () => {
		try {
			if (connection?.name === databaseName && /^mn_follow_[a-f\d]{24}$/.test(databaseName)) {
				await connection.dropDatabase();
			}
		} finally {
			await connection?.close();
		}
	});

	it('reproduces the null/null failure, preserves records and allows distinct follow pairs after repair', async () => {
		const followerId = new Types.ObjectId();
		const first = { followerId, followingId: new Types.ObjectId() };
		const second = { followerId, followingId: new Types.ObjectId() };
		const third = { followerId: new Types.ObjectId(), followingId: first.followingId };
		const original = await follows.create(first);
		await expect(follows.create(second)).rejects.toMatchObject({
			code: 11000,
			keyPattern: { followingMemberId: 1, followerMemberId: 1 },
			keyValue: { followingMemberId: null, followerMemberId: null },
		});

		await repairFollowIndexes(connection.db.collection('follows'), { apply: true, log: () => undefined });
		expect(await follows.countDocuments()).toBe(1);
		expect((await follows.findById(original._id)).followingId).toEqual(first.followingId);
		await follows.create(second);
		await follows.create(third);
		expect(await follows.countDocuments()).toBe(3);
		await expect(follows.create(second)).rejects.toMatchObject({
			code: 11000,
			keyPattern: { followingId: 1, followerId: 1 },
		});
		await follows.findOneAndDelete(second);
		await follows.create(second);
		expect(await follows.countDocuments()).toBe(3);
		await repairFollowIndexes(connection.db.collection('follows'), { apply: true, log: () => undefined });
		expect(await follows.countDocuments()).toBe(3);
	});
});

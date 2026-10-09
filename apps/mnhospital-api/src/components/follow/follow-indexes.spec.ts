const { repairFollowIndexes } = require('../../../../../scripts/repair-follow-indexes');

const current = { name: 'followingId_1_followerId_1', key: { followingId: 1, followerId: 1 }, unique: true };
const legacy = { name: 'followingMemberId_1_followerMemberId_1', key: { followingMemberId: 1, followerMemberId: 1 }, unique: true };

describe('Follow index repair', () => {
	let follows: any;
	beforeEach(() => {
		follows = {
			indexes: jest.fn().mockResolvedValue([current, legacy]),
			countDocuments: jest.fn().mockResolvedValue(0),
			aggregate: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
			createIndex: jest.fn().mockResolvedValue(current.name),
			dropIndex: jest.fn().mockResolvedValue({ ok: 1 }),
		};
	});
	const options = { apply: true, log: jest.fn() };

	it('previews the repair without changing the database', async () => {
		await repairFollowIndexes(follows, { log: jest.fn() });
		expect(follows.createIndex).not.toHaveBeenCalled();
		expect(follows.dropIndex).not.toHaveBeenCalled();
	});

	it('drops only the obsolete compound index and preserves current uniqueness', async () => {
		await repairFollowIndexes(follows, options);
		expect(follows.dropIndex).toHaveBeenCalledTimes(1);
		expect(follows.dropIndex).toHaveBeenCalledWith(legacy.name);
		expect(follows.createIndex).not.toHaveBeenCalled();
	});

	it('creates current unique protection before removing the legacy index', async () => {
		follows.indexes.mockResolvedValue([legacy]);
		await repairFollowIndexes(follows, options);
		expect(follows.createIndex).toHaveBeenCalledWith(current.key, { name: current.name, unique: true });
		expect(follows.createIndex.mock.invocationCallOrder[0]).toBeLessThan(follows.dropIndex.mock.invocationCallOrder[0]);
	});

	it('preserves the legacy index if creating the new unique index fails', async () => {
		follows.indexes.mockResolvedValue([legacy]);
		follows.createIndex.mockRejectedValue(new Error('index creation failed'));
		await expect(repairFollowIndexes(follows, options)).rejects.toThrow('index creation failed');
		expect(follows.dropIndex).not.toHaveBeenCalled();
	});

	it('refuses to drop protection for legacy or malformed records', async () => {
		follows.countDocuments.mockResolvedValue(1);
		await expect(repairFollowIndexes(follows, options)).rejects.toThrow('require a data migration');
		expect(follows.dropIndex).not.toHaveBeenCalled();
	});

	it('refuses duplicate pairs when the current unique index is missing', async () => {
		follows.indexes.mockResolvedValue([legacy]);
		follows.aggregate.mockReturnValue({ toArray: jest.fn().mockResolvedValue([{ count: 2 }]) });
		await expect(repairFollowIndexes(follows, options)).rejects.toThrow('Duplicate follow pairs');
		expect(follows.createIndex).not.toHaveBeenCalled();
		expect(follows.dropIndex).not.toHaveBeenCalled();
	});

	it.each([
		{ indexes: [{ ...legacy, key: { anotherField: 1 } }, current] },
		{ indexes: [legacy, { ...current, unique: false }] },
		{ indexes: [legacy, { ...current, partialFilterExpression: { followingId: { $exists: true } } }] },
	])('rejects unexpected index definitions without mutation', async ({ indexes }) => {
		follows.indexes.mockResolvedValue(indexes);
		await expect(repairFollowIndexes(follows, options)).rejects.toThrow('Unexpected index definition');
		expect(follows.dropIndex).not.toHaveBeenCalled();
	});

	it('can be run again after a successful repair', async () => {
		follows.indexes.mockResolvedValue([current]);
		await repairFollowIndexes(follows, options);
		expect(follows.createIndex).not.toHaveBeenCalled();
		expect(follows.dropIndex).not.toHaveBeenCalled();
	});
});

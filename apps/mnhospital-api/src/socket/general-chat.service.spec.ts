import { GeneralChatService, GENERAL_HISTORY_LIMIT } from './general-chat.service';

describe('Persistent general chat history', () => {
	it('reads the latest fifty messages from storage and returns chronological public fields', async () => {
		const records = [
			{ messageId: 'later', text: 'Second', name: 'Guest', role: 'GUEST', createdAt: new Date('2026-10-06T10:00:01Z'), _id: 'internal' },
			{ messageId: 'earlier', text: 'First', name: 'Guest', role: 'GUEST', createdAt: new Date('2026-10-06T10:00:00Z'), _id: 'internal' },
		];
		const query = { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(records) };
		const model = { find: jest.fn().mockReturnValue(query) };
		const result = await new GeneralChatService(model as any).getRecentMessages();
		expect(query.sort).toHaveBeenCalledWith({ createdAt: -1, messageId: -1 });
		expect(query.limit).toHaveBeenCalledWith(GENERAL_HISTORY_LIMIT);
		expect(result.map((item) => item.id)).toEqual(['earlier', 'later']);
		expect(result[0]).not.toHaveProperty('_id');
	});

	it('stores only the verified display identity and text', async () => {
		const model = { create: jest.fn().mockResolvedValue({ messageId: 'saved', text: 'Hello', name: 'Guest', role: 'GUEST', createdAt: new Date('2026-10-06T10:00:00Z') }) };
		const service = new GeneralChatService(model as any);
		const message = await service.createMessage({ name: 'Guest', role: 'GUEST', profileId: 'private' } as any, 'Hello');
		expect(model.create).toHaveBeenCalledWith({ name: 'Guest', role: 'GUEST', text: 'Hello' });
		expect(message).toEqual({ id: 'saved', text: 'Hello', name: 'Guest', role: 'GUEST', createdAt: '2026-10-06T10:00:00.000Z' });
	});

	it('propagates a storage failure instead of inventing a delivered message', async () => {
		const model = { create: jest.fn().mockRejectedValue(new Error('database unavailable')) };
		await expect(new GeneralChatService(model as any).createMessage({ name: 'Guest', role: 'GUEST' }, 'Hello')).rejects.toThrow('database unavailable');
	});
});

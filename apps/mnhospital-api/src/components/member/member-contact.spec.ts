import { Types } from 'mongoose';
import { MemberService } from './member.service';

describe('Member contact update', () => {
	const memberId = new Types.ObjectId();

	it.each([
		['memberPhone', 'phone number'],
		['memberMail', 'email address'],
	])('reports a duplicate %s as a client error', async (field, message) => {
		const exec = jest.fn().mockRejectedValue({ code: 11000, keyPattern: { [field]: 1 } });
		const findOneAndUpdate = jest.fn().mockReturnValue({ exec });
		const service = new MemberService(
			{ findOneAndUpdate } as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
		);

		await expect(service.updateMember(memberId, { _id: memberId, [field]: 'value' } as any)).rejects.toMatchObject({
			status: 400,
			message: expect.stringContaining(message),
		});
		expect(findOneAndUpdate).toHaveBeenCalledWith(
			expect.objectContaining({ _id: memberId }),
			expect.objectContaining({ [field]: 'value' }),
			expect.objectContaining({ runValidators: true }),
		);
	});
});

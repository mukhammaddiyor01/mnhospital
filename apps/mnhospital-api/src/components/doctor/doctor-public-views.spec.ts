import { Types } from 'mongoose';
import { DoctorService } from './doctor.service';
import { MemberStatus } from '../member/enums/member.enum';
describe('Public doctor profile views', () => {
	const id = new Types.ObjectId();
	let model: any, service: DoctorService;
	beforeEach(() => {
		model = {
			findOne: jest.fn(() => ({ lean: () => ({ exec: async () => ({ _id: id, docViews: 7 }) }) })),
			findOneAndUpdate: jest.fn(() => ({ select: () => ({ lean: () => ({ exec: async () => ({ docViews: 8 }) }) }) })),
		};
		service = new DoctorService(model, null, null, null, null, null, null, null, null);
	});
	it('records a public profile read with a single atomic increment and returns the persisted count', async () => {
		expect((await service.getDoctor(id)).docViews).toBe(8);
		expect(model.findOneAndUpdate).toHaveBeenCalledWith(
			{ _id: id, memberStatus: { $in: [MemberStatus.ACTIVE, MemberStatus.BLOCK] }, deletedAt: { $exists: false } },
			{ $inc: { docViews: 1 } },
			{ new: true },
		);
	});
	it('does not count internal doctor metadata lookup as a profile view', async () => {
		await service.findPublicDoctor(id);
		expect(model.findOneAndUpdate).not.toHaveBeenCalled();
	});
	it('does not count missing or archived profiles', async () => {
		model.findOne.mockReturnValue({ lean: () => ({ exec: async () => null }) });
		await expect(service.getDoctor(id)).rejects.toThrow();
		expect(model.findOneAndUpdate).not.toHaveBeenCalled();
	});
	it('rejects a profile archived between lookup and counter update', async () => {
		model.findOneAndUpdate.mockReturnValue({ select: () => ({ lean: () => ({ exec: async () => null }) }) });
		await expect(service.getDoctor(id)).rejects.toThrow();
	});
});

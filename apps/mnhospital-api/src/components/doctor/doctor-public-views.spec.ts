import { Types } from 'mongoose';
import { DoctorService } from './doctor.service';
import { MemberStatus } from '../member/enums/member.enum';
import { ViewGroup } from '../view/enums/view.enum';

describe('Unique doctor profile views', () => {
 const id = new Types.ObjectId(), viewer = new Types.ObjectId();
 let model: any, views: any, service: DoctorService;
 beforeEach(() => {
  model = {
   findOne: jest.fn(() => ({ lean: () => ({ exec: async () => ({ _id: id, docViews: 7 }) }) })),
   findOneAndUpdate: jest.fn(() => ({ select: () => ({ lean: () => ({ exec: async () => ({ docViews: 8 }) }) }) })),
  };
  views = { recordView: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }) };
  service = new DoctorService(model, null, null, null, null, null, null, null, null, views);
  jest.spyOn(service, 'findPublicDoctor').mockImplementation(async () => model.findOne().lean().exec());
 });
 it('increments only for a newly recorded authenticated view', async () => {
  expect((await service.getDoctor(id, viewer)).docViews).toBe(8);
  expect(views.recordView).toHaveBeenCalledWith({ memberId: viewer, viewRefId: id, viewGroup: ViewGroup.DOCTOR });
  expect(model.findOneAndUpdate).toHaveBeenCalledWith(
   { _id: id, memberStatus: { $in: [MemberStatus.ACTIVE, MemberStatus.BLOCK] }, deletedAt: { $exists: false } },
   { $inc: { docViews: 1 } }, { new: true },
  );
 });
 it('does not increment when the viewer has already seen this doctor', async () => {
  views.recordView.mockResolvedValue(null);
  expect((await service.getDoctor(id, viewer)).docViews).toBe(7);
  expect(model.findOneAndUpdate).not.toHaveBeenCalled();
 });
 it('does not count anonymous requests', async () => {
  expect((await service.getDoctor(id)).docViews).toBe(7);
  expect(views.recordView).not.toHaveBeenCalled();
  expect(model.findOneAndUpdate).not.toHaveBeenCalled();
 });
 it('does not count internal doctor metadata lookup as a profile view', async () => {
  await service.findPublicDoctor(id);
  expect(views.recordView).not.toHaveBeenCalled();
  expect(model.findOneAndUpdate).not.toHaveBeenCalled();
 });
 it('does not count missing or archived profiles', async () => {
  model.findOne.mockReturnValue({ lean: () => ({ exec: async () => null }) });
  await expect(service.getDoctor(id, viewer)).rejects.toThrow();
  expect(views.recordView).not.toHaveBeenCalled();
  expect(model.findOneAndUpdate).not.toHaveBeenCalled();
 });
 it('rejects a profile archived between lookup and counter update', async () => {
  model.findOneAndUpdate.mockReturnValue({ select: () => ({ lean: () => ({ exec: async () => null }) }) });
  await expect(service.getDoctor(id, viewer)).rejects.toThrow();
 });
 it('propagates a view persistence failure before incrementing the counter', async () => {
  views.recordView.mockRejectedValue(new Error('Database unavailable'));
  await expect(service.getDoctor(id, viewer)).rejects.toThrow('Database unavailable');
  expect(model.findOneAndUpdate).not.toHaveBeenCalled();
 });
});

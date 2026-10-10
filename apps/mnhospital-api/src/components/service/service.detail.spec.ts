import { Types } from 'mongoose';
import { DoctorService } from '../doctor/doctor.service';
import { MemberStatus } from '../member/enums/member.enum';
import { ServiceService } from './service.service';
import { ServiceStatus } from './enums/service.enum';

describe('Public service details with an optional doctor profile', () => {
	const doctorId = new Types.ObjectId();
	const serviceId = new Types.ObjectId();
	let doctorModel: { findOne: jest.Mock };
	let serviceModel: { findOne: jest.Mock };
	let doctors: DoctorService;
	let services: ServiceService;

	beforeEach(() => {
		doctorModel = { findOne: jest.fn(() => ({ lean: () => ({ exec: async () => null }) })) };
		serviceModel = {
			findOne: jest.fn(() => ({ lean: () => ({ exec: async () => ({
				_id: serviceId, memberId: doctorId, serviceTitle: 'Consultation',
				serviceDesc: 'Published service description', serviceStatus: ServiceStatus.ACTIVE,
			}) }) })),
		};
		doctors = new DoctorService(doctorModel as never, null, null, null, null, null, null, null, null, null);
		services = new ServiceService(serviceModel as never, null, doctors, null, null, null);
	});

	it('keeps an active service readable when its doctor was deleted or is missing', async () => {
		const result = await services.getService(undefined, serviceId);
		expect(result.serviceTitle).toBe('Consultation');
		expect(result.serviceDesc).toBe('Published service description');
		expect(result.memberData).toBeUndefined();
		expect(doctorModel.findOne).toHaveBeenCalledWith({
			_id: doctorId, memberStatus: { $in: [MemberStatus.ACTIVE, MemberStatus.BLOCK] },
			deletedAt: { $exists: false },
		});
	});

	it('retains the public doctor profile when it exists', async () => {
		const doctor = { _id: doctorId, docFullName: 'Doctor', memberStatus: MemberStatus.ACTIVE };
		doctorModel.findOne.mockReturnValue({ lean: () => ({ exec: async () => doctor }) });
		expect((await services.getService(undefined, serviceId)).memberData).toEqual(doctor);
	});

	it('keeps direct doctor lookup unavailable for a deleted or missing profile', async () => {
		await expect(doctors.getDoctor(doctorId)).rejects.toThrow('No data is found!');
	});

	it('does not publish an inactive or missing service', async () => {
		serviceModel.findOne.mockReturnValue({ lean: () => ({ exec: async () => null }) });
		await expect(services.getService(undefined, serviceId)).rejects.toThrow('No data is found!');
		expect(serviceModel.findOne).toHaveBeenCalledWith({ _id: serviceId, serviceStatus: ServiceStatus.ACTIVE });
		expect(doctorModel.findOne).not.toHaveBeenCalled();
	});

	it('propagates database failures instead of treating them as a missing doctor', async () => {
		doctorModel.findOne.mockReturnValue({ lean: () => ({ exec: async () => { throw new Error('Database unavailable'); } }) });
		await expect(services.getService(undefined, serviceId)).rejects.toThrow('Database unavailable');
	});
});

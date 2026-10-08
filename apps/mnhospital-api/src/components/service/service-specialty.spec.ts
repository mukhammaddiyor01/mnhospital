import 'reflect-metadata';
import { Types } from 'mongoose';
import { ServiceService } from './service.service';
import { ServiceResolver } from './service.resolver';
import { AdminService } from '../admin/admin.service';
import { DoctorSpecialty } from '../doctor/enums/doctor.enum';
import { assertSpecialtyServiceType, serviceTypesForSpecialty } from '../doctor/doctor-specialty.policy';
import { ServiceStatus, ServiceType } from './enums/service.enum';
import { MemberType } from '../member/enums/member.enum';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('Doctor specialty and service type boundaries', () => {
	const owner = new Types.ObjectId(), id = new Types.ObjectId();
	let model: { create: jest.Mock; countDocuments: jest.Mock; findOne: jest.Mock; findOneAndUpdate: jest.Mock };
	let doctors: { getDoctorByAdmin: jest.Mock; doctorStatisticEditor: jest.Mock };
	let service: ServiceService;
	beforeEach(() => {
		model = {
			create: jest.fn().mockResolvedValue({ _id: id }),
			countDocuments: jest.fn().mockReturnValue({ exec: async () => 0 }),
			findOne: jest.fn().mockReturnValue({ exec: async () => ({ _id: id, memberId: owner, serviceType: ServiceType.CARDIOLOGY }) }),
			findOneAndUpdate: jest.fn().mockReturnValue({ exec: async () => ({ _id: id }) }),
		};
		doctors = { getDoctorByAdmin: jest.fn().mockResolvedValue({ docSpecialty: DoctorSpecialty.CARDIOLOGIST }), doctorStatisticEditor: jest.fn() };
		service = new ServiceService(model as never, null, doctors as never, null, null, null);
	});

	it('covers every specialty and every existing service category without treating service categories as specialties', () => {
		expect(Object.values(DoctorSpecialty)).toHaveLength(13);
		expect(new Set(Object.values(DoctorSpecialty).flatMap(serviceTypesForSpecialty))).toEqual(new Set(Object.values(ServiceType)));
		for (const specialty of Object.values(DoctorSpecialty)) expect(serviceTypesForSpecialty(specialty)).toContain(ServiceType.CONSULTATION);
		expect(serviceTypesForSpecialty(undefined)).toEqual([]);
		expect(() => assertSpecialtyServiceType(DoctorSpecialty.NEUROLOGIST, ServiceType.NEUROSURGERY)).toThrow('does not match');
		expect(() => assertSpecialtyServiceType(DoctorSpecialty.SURGEON, ServiceType.PLASTIC_SURGERY)).toThrow('does not match');
	});

	it.each([
		[DoctorSpecialty.UROLOGIST, ServiceType.UROLOGY],
		[DoctorSpecialty.OPHTHALMOLOGIST, ServiceType.OPHTHAL],
		[DoctorSpecialty.NEUROSURGEON, ServiceType.NEUROSURGERY],
		[DoctorSpecialty.PLASTIC_SURGEON, ServiceType.PLASTIC_SURGERY],
		[DoctorSpecialty.OBSTETRICIAN_GYNECOLOGIST, ServiceType.OBSTETRICS_GYNECOLOGY],
		[DoctorSpecialty.FAMILY_PHYSICIAN, ServiceType.FAMILY_MEDICINE],
	])('allows the matching new specialty %s to create %s', async (specialty, type) => {
		doctors.getDoctorByAdmin.mockResolvedValue({ docSpecialty: specialty });
		await service.createService({ memberId: owner, serviceType: type } as never);
		expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ memberId: owner, serviceType: type }));
	});

	it('rejects unrelated service creation before persisting or counting it', async () => {
		await expect(service.createService({ memberId: owner, serviceType: ServiceType.DENTISTRY } as never)).rejects.toThrow('does not match');
		expect(model.countDocuments).not.toHaveBeenCalled();
		expect(model.create).not.toHaveBeenCalled();
	});

	it('requires an assigned specialty before creating a service', async () => {
		doctors.getDoctorByAdmin.mockResolvedValue({});
		await expect(service.createService({ memberId: owner, serviceType: ServiceType.CONSULTATION } as never)).rejects.toThrow('does not match');
		expect(model.create).not.toHaveBeenCalled();
	});

	it('checks the stored owner when a doctor changes a type', async () => {
		await expect(service.updateService(owner, { _id: id, serviceType: ServiceType.UROLOGY } as never)).rejects.toThrow('does not match');
		expect(doctors.getDoctorByAdmin).toHaveBeenCalledWith(owner);
		expect(model.findOneAndUpdate).not.toHaveBeenCalled();
	});

	it('keeps service ownership checks ahead of specialty lookup', async () => {
		model.findOne.mockReturnValue({ exec: async () => null });
		await expect(service.updateService(new Types.ObjectId(), { _id: id, serviceType: ServiceType.CARDIOLOGY } as never)).rejects.toThrow();
		expect(doctors.getDoctorByAdmin).not.toHaveBeenCalled();
	});

	it('blocks reactivation when a legacy type is incompatible', async () => {
		doctors.getDoctorByAdmin.mockResolvedValue({ docSpecialty: DoctorSpecialty.DENTIST });
		await expect(service.updateService(owner, { _id: id, serviceStatus: ServiceStatus.ACTIVE } as never)).rejects.toThrow('does not match');
		expect(model.findOneAndUpdate).not.toHaveBeenCalled();
	});

	it('still allows archiving an incompatible legacy service', async () => {
		await service.updateService(owner, { _id: id, serviceStatus: ServiceStatus.DELETED } as never);
		expect(doctors.getDoctorByAdmin).not.toHaveBeenCalled();
		expect(model.findOneAndUpdate).toHaveBeenCalled();
	});

	it('enforces the same mapping for admin type changes and reactivation', async () => {
		const admin = new AdminService(null, null, null, null, null, null, null, model as never, null, null, doctors as never, null);
		await expect(admin.updateServiceByAdmin({ _id: id, serviceType: ServiceType.DENTISTRY } as never)).rejects.toThrow('does not match');
		doctors.getDoctorByAdmin.mockResolvedValue({ docSpecialty: DoctorSpecialty.DENTIST });
		await expect(admin.updateServiceByAdmin({ _id: id, serviceStatus: ServiceStatus.ACTIVE } as never)).rejects.toThrow('does not match');
		expect(model.findOneAndUpdate).not.toHaveBeenCalled();
	});

	it('returns allowed categories only for the authenticated doctor query', async () => {
		const handler = ServiceResolver.prototype.getMyDoctorServiceTypes;
		expect(Reflect.getMetadata('roles', handler)).toEqual([MemberType.DOCTOR]);
		expect(Reflect.getMetadata('__guards__', handler)).toContain(RolesGuard);
		const resolver = new ServiceResolver(service);
		expect(await resolver.getMyDoctorServiceTypes(owner)).toContain(ServiceType.CARDIOLOGY);
		expect(doctors.getDoctorByAdmin).toHaveBeenCalledWith(owner);
	});
});

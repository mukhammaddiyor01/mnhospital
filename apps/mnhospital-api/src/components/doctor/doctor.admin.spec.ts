import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { DoctorService } from './doctor.service';
import { DoctorResolver } from './doctor.resolver';
import { DoctorAdminUpdateInput } from './dto/doctor-admin.input';
import { MemberStatus, MemberType } from '../member/enums/member.enum';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DoctorSpecialty } from './enums/doctor.enum';

describe('Admin doctor profile editing', () => {
	const id = new Types.ObjectId();
	const scope = {
		_id: id,
		memberType: MemberType.DOCTOR,
		memberStatus: { $in: [MemberStatus.ACTIVE, MemberStatus.BLOCK] },
		deletedAt: { $exists: false },
	};
	let model: { findOneAndUpdate: jest.Mock; findOne: jest.Mock };
	let serviceModel: { countDocuments: jest.Mock };
	let auth: { createToken: jest.Mock; revokeOwnerSessions: jest.Mock };
	let service: DoctorService;
	beforeEach(() => {
		model = { findOneAndUpdate: jest.fn().mockReturnValue({ exec: async () => ({ _id: id }) }), findOne: jest.fn().mockReturnValue({ exec: async () => ({ _id: id, docSpecialty: DoctorSpecialty.CARDIOLOGIST }) }) };
		serviceModel = { countDocuments: jest.fn().mockReturnValue({ exec: async () => 0 }) };
		auth = { createToken: jest.fn(), revokeOwnerSessions: jest.fn().mockResolvedValue(undefined) };
		service = new DoctorService(model as any, null, null, serviceModel as any, null, null, auth as any, null, null);
	});

	it('restricts the mutation to verified admin tokens', async () => {
		const handler = DoctorResolver.prototype.updateDoctorByAdmin;
		expect(Reflect.getMetadata('roles', handler)).toEqual([MemberType.ADMIN]);
		expect(Reflect.getMetadata('__guards__', handler)).toContain(RolesGuard);
		for (const memberType of Object.values(MemberType)) {
			const request = { headers: { authorization: 'Bearer test-token' }, body: {} };
			const guard = new RolesGuard(new Reflector(), { verifyToken: async () => ({ _id: id, memberType }) } as any);
			const context = { contextType: 'graphql', getHandler: () => handler, getArgByIndex: () => ({ req: request }) };
			if (memberType === MemberType.ADMIN) expect(await guard.canActivate(context)).toBe(true);
			else await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403 });
		}
	});

	it('projects editable fields and never issues a doctor token or edits identity and office', async () => {
		const input = {
			_id: id,
			docFullName: ' Updated Doctor ',
			docPhone: '+821012345678',
			docExperience: 9,
			docSpecialty: DoctorSpecialty.CARDIOLOGIST,
			docImage: ' uploads/doctor/image.png ',
			memberStatus: MemberStatus.BLOCK,
			docNick: 'other-login',
			docPassword: 'secret',
			docRoom: '999',
			memberType: MemberType.ADMIN,
			docPoints: 999,
		};
		await service.updateDoctorByAdmin(id, input as any);
		expect(model.findOneAndUpdate).toHaveBeenCalledWith(
			scope,
			{
				$inc: { sessionVersion: 1 },
				$set: {
					docFullName: 'Updated Doctor',
					docPhone: '+821012345678',
					docExperience: 9,
					docSpecialty: DoctorSpecialty.CARDIOLOGIST,
					docImage: 'uploads/doctor/image.png',
					memberStatus: MemberStatus.BLOCK,
				},
			},
			{ new: true, runValidators: true },
		);
		expect(auth.createToken).not.toHaveBeenCalled();
		expect(auth.revokeOwnerSessions).toHaveBeenCalledWith(id, MemberType.DOCTOR);
	});

	it('normalizes contacts and clears optional email without violating its sparse unique index', async () => {
		await service.updateDoctorByAdmin(id, { _id: id, docMail: ' DOCTOR@EXAMPLE.COM ', docAddress: ' Seoul ' });
		expect(model.findOneAndUpdate).toHaveBeenLastCalledWith(
			scope,
			{ $set: { docMail: 'doctor@example.com', docAddress: 'Seoul' } },
			{ new: true, runValidators: true },
		);
		await service.updateDoctorByAdmin(id, { _id: id, docMail: ' ', docImage: '', docDesc: '' });
		expect(model.findOneAndUpdate).toHaveBeenLastCalledWith(
			scope,
			{ $set: { docImage: '', docDesc: '' }, $unset: { docMail: 1 } },
			{ new: true, runValidators: true },
		);
	});

	it('rejects a specialty change that would invalidate active services', async () => {
		serviceModel.countDocuments.mockReturnValue({ exec: async () => 1 });
		await expect(service.updateDoctorByAdmin(id, { _id: id, docSpecialty: DoctorSpecialty.UROLOGIST })).rejects.toThrow('incompatible services');
		expect(model.findOneAndUpdate).not.toHaveBeenCalled();
	});

	it('allows a new specialty after incompatible services have been deactivated', async () => {
		await service.updateDoctorByAdmin(id, { _id: id, docSpecialty: DoctorSpecialty.UROLOGIST });
		expect(serviceModel.countDocuments).toHaveBeenCalledWith(expect.objectContaining({ memberId: id, serviceType: { $nin: expect.arrayContaining(['UROLOGY']) } }));
		expect(model.findOneAndUpdate).toHaveBeenCalled();
	});

	it('allows restoring a blocked account without restoring archived accounts', async () => {
		await service.updateDoctorByAdmin(id, { _id: id, memberStatus: MemberStatus.ACTIVE });
		expect(model.findOneAndUpdate.mock.calls[0][0]).toEqual(scope);
		model.findOneAndUpdate.mockReturnValue({ exec: async () => null });
		await expect(service.updateDoctorByAdmin(id, { _id: id, memberStatus: MemberStatus.ACTIVE })).rejects.toThrow(
			'archived',
		);
	});

	it('keeps deletion separate from profile edits and rejects uneditable-only input', async () => {
		await expect(service.updateDoctorByAdmin(id, { _id: id, memberStatus: MemberStatus.DELETE })).rejects.toThrow(
			'separate remove',
		);
		await expect(service.updateDoctorByAdmin(id, { _id: id, docRoom: '999' } as any)).rejects.toThrow(
			'No doctor changes',
		);
		expect(model.findOneAndUpdate).not.toHaveBeenCalled();
	});

	it('reports duplicate contacts and invalid model values as request errors', async () => {
		for (const error of [{ code: 11000 }, { name: 'ValidationError' }]) {
			model.findOneAndUpdate.mockReturnValue({
				exec: async () => {
					throw error;
				},
			});
			await expect(service.updateDoctorByAdmin(id, { _id: id, docPhone: '+821012345678' })).rejects.toMatchObject({
				status: 400,
			});
		}
	});

	it('does not expose raw database failure details', async () => {
		model.findOneAndUpdate.mockReturnValue({
			exec: async () => {
				throw new Error('private database details');
			},
		});
		await expect(service.updateDoctorByAdmin(id, { _id: id, docDesc: 'Updated' })).rejects.toThrow(
			'Doctor profile update failed',
		);
	});

	it('validates inherited contact fields, IDs, operational fields and account status', async () => {
		for (const changes of [
			{ _id: 'invalid' },
			{ docPhone: null },
			{ docPhone: '12' },
			{ docMail: 'invalid' },
			{ docFullName: '' },
			{ docExperience: -1 },
			{ docExperience: 1.5 },
			{ docSpecialty: 'UNKNOWN' },
			{ memberStatus: MemberStatus.DELETE },
			{ memberStatus: null },
			{ docImage: 'x'.repeat(501) },
		]) {
			expect(
				(await validate(plainToInstance(DoctorAdminUpdateInput, { _id: String(id), ...changes }))).length,
			).toBeGreaterThan(0);
		}
		const input = plainToInstance(DoctorAdminUpdateInput, {
			_id: String(id),
			docMail: '',
			docExperience: 0,
			memberStatus: MemberStatus.BLOCK,
		});
		expect(await validate(input)).toHaveLength(0);
		expect(input._id).toBeInstanceOf(Types.ObjectId);
	});
});

import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Message } from '../../libs/enums/common.enum';
import { Patient } from './dto/patient';
import { PatientProfileInput } from './dto/patient.input';
import { MemberStatus, MemberType } from '../member/enums/member.enum';

@Injectable()
export class PatientService {
	constructor(@InjectModel('Patient') private readonly patientModel: Model<Patient>) {}

	public async createProfile(memberId: ObjectId, input: PatientProfileInput): Promise<Patient> {
		const existing = await this.patientModel.findOne({ memberId }).exec();
		if (existing) throw new BadRequestException(Message.CREATE_FAILED);

		return await this.patientModel.create({
			...input,
			memberId,
			memberType: MemberType.PATIENT,
			memberStatus: MemberStatus.ACTIVE,
		});
	}

	public async getMyProfile(memberId: ObjectId): Promise<Patient> {
		const result = await this.patientModel
			.findOne({ memberId, memberStatus: MemberStatus.ACTIVE, deletedAt: { $exists: false } })
			.exec();
		if (!result) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		return result;
	}

	public async updateMyProfile(memberId: ObjectId, input: PatientProfileInput): Promise<Patient> {
		const result = await this.patientModel
			.findOneAndUpdate(
				{ memberId, memberStatus: MemberStatus.ACTIVE, deletedAt: { $exists: false } },
				{ $set: input },
				{ new: true, runValidators: true },
			)
			.exec();
		if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);
		return result;
	}

	public async updateStatusByAdmin(patientId: ObjectId, memberStatus: MemberStatus): Promise<Patient> {
		const patient = await this.patientModel
			.findOne({ _id: patientId, memberType: MemberType.PATIENT, deletedAt: { $exists: false } })
			.exec();
		if (!patient) throw new InternalServerErrorException('Patient was not found');

		const updateData: Record<string, unknown> = { memberStatus };
		if (memberStatus === MemberStatus.DELETE) updateData.deletedAt = new Date();

		const result = await this.patientModel
			.findOneAndUpdate({ _id: patientId, memberType: MemberType.PATIENT }, { $set: updateData }, { new: true, runValidators: true })
			.exec();
		if (!result) throw new InternalServerErrorException('Patient status update failed');
		return result;
	}

	public async resolveProfileId(memberId: ObjectId): Promise<ObjectId> {
		const patient = await this.patientModel
			.findOne({ memberId, memberStatus: MemberStatus.ACTIVE, deletedAt: { $exists: false } })
			.select('_id')
			.lean()
			.exec();
		if (!patient) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		return patient._id;
	}
}

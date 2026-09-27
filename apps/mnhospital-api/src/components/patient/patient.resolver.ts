import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType } from '../member/enums/member.enum';
import { Patient, Patients } from './dto/patient';
import { AdminPatientInquiry, PatientProfileInput, PatientStatusUpdateInput } from './dto/patient.input';
import { PatientService } from './patient.service';
import { shapeIntoMongoObjectId } from '../../libs/config';

@Resolver()
export class PatientResolver {
	constructor(private readonly patientService: PatientService) {}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Mutation(() => Patient)
	public async createPatientProfile(
		@Args('input') input: PatientProfileInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Patient> {
		console.log('Mutation: createPatientProfile');
		return await this.patientService.createProfile(memberId, input);
	}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Query(() => Patient)
	public async getMyPatientProfile(@AuthMember('_id') memberId: ObjectId): Promise<Patient> {
		console.log('Query: getMyPatientProfile');
		return await this.patientService.getMyProfile(memberId);
	}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Mutation(() => Patient)
	public async updateMyPatientProfile(
		@Args('input') input: PatientProfileInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Patient> {
		console.log('Mutation: updateMyPatientProfile');
		return await this.patientService.updateMyProfile(memberId, input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Patient)
	public async updatePatientStatusByAdmin(@Args('input') input: PatientStatusUpdateInput): Promise<Patient> {
		console.log('Mutation: updatePatientStatusByAdmin');
		return await this.patientService.updateStatusByAdmin(input._id, input.memberStatus);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => Patients)
	public async getPatientsByAdmin(@Args('input') input: AdminPatientInquiry): Promise<Patients> {
		console.log('Query: getPatientsByAdmin');
		return this.patientService.getPatientsByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => Patient)
	public async getPatientByAdmin(@Args('patientId') patientId: string): Promise<Patient> {
		console.log('Query: getPatientByAdmin');
		return this.patientService.getPatientByAdmin(shapeIntoMongoObjectId(patientId));
	}
}

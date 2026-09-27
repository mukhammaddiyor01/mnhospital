import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { WithoutGuard } from '../auth/guards/without.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType } from '../member/enums/member.enum';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { DoctorService } from './doctor.service';
import { Doctor, Doctors } from './dto/doctor';
import { AdminDoctorInquiry, DoctorInput, DoctorLoginInput, DoctorStatusUpdateInput, DoctorsInquiry } from './dto/doctor.input';
import { DoctorDashboardStats } from './dto/doctor-dashboard';

@Resolver()
export class DoctorResolver {
	constructor(private readonly doctorService: DoctorService) {}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Doctor)
	public async createDoctorByAdmin(@Args('input') input: DoctorInput): Promise<Doctor> {
		console.log('Mutation: createDoctorByAdmin');
		return this.doctorService.createDoctorByAdmin(input);
	}

	@Mutation(() => Doctor)
	public async loginDoctor(@Args('input') input: DoctorLoginInput): Promise<Doctor> {
		console.log('Mutation: loginDoctor');
		return this.doctorService.loginDoctor(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Doctor)
	public async updateDoctorStatusByAdmin(@Args('input') input: DoctorStatusUpdateInput): Promise<Doctor> {
		console.log('Mutation: updateDoctorStatusByAdmin');
		return this.doctorService.updateStatusByAdmin(input._id, input.memberStatus);
	}

	@Roles(MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Query(() => DoctorDashboardStats)
	public async getMyDoctorDashboardStats(@AuthMember('_id') doctorId: ObjectId): Promise<DoctorDashboardStats> {
		console.log('Query: getMyDoctorDashboardStats');
		return this.doctorService.getDashboardStats(doctorId);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => DoctorDashboardStats)
	public async getDoctorDashboardStatsByAdmin(@Args('doctorId') doctorId: string): Promise<DoctorDashboardStats> {
		console.log('Query: getDoctorDashboardStatsByAdmin');
		return this.doctorService.getDashboardStats(shapeIntoMongoObjectId(doctorId));
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => Doctors)
	public async getDoctorsByAdmin(@Args('input') input: AdminDoctorInquiry): Promise<Doctors> {
		console.log('Query: getDoctorsByAdmin');
		return this.doctorService.getDoctorsByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => Doctor)
	public async getDoctorByAdmin(@Args('doctorId') doctorId: string): Promise<Doctor> {
		console.log('Query: getDoctorByAdmin');
		return this.doctorService.getDoctorByAdmin(shapeIntoMongoObjectId(doctorId));
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Doctor)
	public async likeTargetDoctor(
		@Args('doctorId') input: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Doctor> {
		console.log('Mutation: likeTargetDoctor');
		return await this.doctorService.likeTargetDoctor(memberId, shapeIntoMongoObjectId(input));
	}

	@UseGuards(WithoutGuard)
	@Query(() => Doctors)
	public async getDoctors(
		@Args('input') input: DoctorsInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Doctors> {
		console.log('Query: getDoctors');
		return this.doctorService.getDoctors(input, memberId);
	}
}

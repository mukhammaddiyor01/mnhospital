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
import { DoctorInput, DoctorLoginInput, DoctorsInquiry } from './dto/doctor.input';

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

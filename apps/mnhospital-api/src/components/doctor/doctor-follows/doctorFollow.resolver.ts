import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { AuthMember } from '../../auth/decorators/authMember.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { WithoutGuard } from '../../auth/guards/without.guard';
import { shapeIntoMongoObjectId } from '../../../libs/config';
import {
	DoctorFollower,
	DoctorFollowers,
	DoctorFollowing,
	DoctorFollowings,
} from './dto/doctorFollow';
import { DoctorFollowInquiry } from './dto/doctorFollow.input';
import { DoctorFollowService } from './doctorFollow.service';
import { MemberType } from '../../member/enums/member.enum';

@Resolver()
export class DoctorFollowResolver {
	constructor(private readonly doctorFollowService: DoctorFollowService) {}

	@Roles(MemberType.PATIENT, MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Mutation(() => DoctorFollowing)
	public async subscribeDoctor(
		@Args('input') input: string,
		@AuthMember('_id') memberId: ObjectId,
		@AuthMember('memberType') memberType: MemberType,
	): Promise<DoctorFollowing> {
		console.log('Mutation: subscribeDoctor');
		return await this.doctorFollowService.subscribeDoctor(memberId, shapeIntoMongoObjectId(input), memberType);
	}

	@Roles(MemberType.PATIENT, MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Mutation(() => DoctorFollowing)
	public async unsubscribeDoctor(
		@Args('input') input: string,
		@AuthMember('_id') memberId: ObjectId,
		@AuthMember('memberType') memberType: MemberType,
	): Promise<DoctorFollowing> {
		console.log('Mutation: unsubscribeDoctor');
		return await this.doctorFollowService.unsubscribeDoctor(memberId, shapeIntoMongoObjectId(input), memberType);
	}

	@UseGuards(WithoutGuard)
	@Query(() => DoctorFollowings)
	public async getDoctorFollowings(
		@Args('input') input: DoctorFollowInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<DoctorFollowings> {
		console.log('Query: getDoctorFollowings');
		if (input.search?.memberId) input.search.memberId = shapeIntoMongoObjectId(input.search.memberId);
		return await this.doctorFollowService.getDoctorFollowings(memberId, input);
	}

	@UseGuards(WithoutGuard)
	@Query(() => DoctorFollowers)
	public async getDoctorFollowers(
		@Args('input') input: DoctorFollowInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<DoctorFollowers> {
		console.log('Query: getDoctorFollowers');
		if (input.search?.doctorId) input.search.doctorId = shapeIntoMongoObjectId(input.search.doctorId);
		return await this.doctorFollowService.getDoctorFollowers(memberId, input);
	}
}

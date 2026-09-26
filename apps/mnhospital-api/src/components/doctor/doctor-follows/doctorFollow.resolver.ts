import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { AuthMember } from '../../auth/decorators/authMember.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
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

@Resolver()
export class DoctorFollowResolver {
	constructor(private readonly doctorFollowService: DoctorFollowService) {}

	@UseGuards(AuthGuard)
	@Mutation(() => DoctorFollowing)
	public async subscribeDoctor(
		@Args('input') input: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<DoctorFollowing> {
		console.log('Mutation: subscribeDoctor');
		return await this.doctorFollowService.subscribeDoctor(memberId, shapeIntoMongoObjectId(input));
	}

	@UseGuards(AuthGuard)
	@Mutation(() => DoctorFollowing)
	public async unsubscribeDoctor(
		@Args('input') input: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<DoctorFollowing> {
		console.log('Mutation: unsubscribeDoctor');
		return await this.doctorFollowService.unsubscribeDoctor(memberId, shapeIntoMongoObjectId(input));
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

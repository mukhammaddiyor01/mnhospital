import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { WithoutGuard } from '../auth/guards/without.guard';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { Follower, Followers, Followings } from './dto/follow';
import { FollowInquiry } from './dto/follow.input';
import { FollowService } from './follow.service';
import { MemberType } from '../member/enums/member.enum';

@Resolver()
export class FollowResolver {
	constructor(private readonly followService: FollowService) {}

	@Roles(MemberType.PATIENT, MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Mutation(() => Follower)
	public async subscribe(@Args('input') input: string, @AuthMember('_id') memberId: ObjectId, @AuthMember('memberType') memberType: MemberType): Promise<Follower> {
		console.log('Mutation: subscribe');
		return await this.followService.subscribe(memberId, shapeIntoMongoObjectId(input), memberType);
	}

	@Roles(MemberType.PATIENT, MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Mutation(() => Follower)
	public async unsubscribe(@Args('input') input: string, @AuthMember('_id') memberId: ObjectId, @AuthMember('memberType') memberType: MemberType): Promise<Follower> {
		console.log('Mutation: unsubscribe');
		return await this.followService.unsubscribe(memberId, shapeIntoMongoObjectId(input), memberType);
	}

	@UseGuards(WithoutGuard)
	@Query(() => Followings)
	public async getMemberFollowings(
		@Args('input') input: FollowInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Followings> {
		console.log('Query: getMemberFollowings');
		if (input.search?.followerId) input.search.followerId = shapeIntoMongoObjectId(input.search.followerId);
		return await this.followService.getMemberFollowings(memberId, input);
	}

	@UseGuards(WithoutGuard)
	@Query(() => Followers)
	public async getMemberFollowers(
		@Args('input') input: FollowInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Followers> {
		console.log('Query: getMemberFollowers');
		if (input.search?.followingId) input.search.followingId = shapeIntoMongoObjectId(input.search.followingId);
		return await this.followService.getMemberFollowers(memberId, input);
	}
}

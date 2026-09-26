import { BadGatewayException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Direction, Message } from '../../libs/enums/common.enum';
import { lookupFollowerData, lookupFollowingData } from '../../libs/config';
import { T } from '../../libs/types/common';
import { LikeService } from '../like/like.service';
import { LikeGroup } from '../like/enums/like.enum';
import { MemberService } from '../member/member.service';
import { Follower, Followers, Following, Followings, MeFollowed } from './dto/follow';
import { FollowInquiry } from './dto/follow.input';

@Injectable()
export class FollowService {
	constructor(
		@InjectModel('Follow') private readonly followModel: Model<Follower | Following>,
		private readonly memberService: MemberService,
		private readonly likeService: LikeService,
	) {}

	public async subscribe(followerId: ObjectId, followingId: ObjectId): Promise<Follower> {
		if (followerId.toString() === followingId.toString()) {
			throw new BadGatewayException(Message.SELF_FOLLOW_DENIED);
		}

		const targetMember = await this.memberService.getMember(null, followingId);
		if (!targetMember) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const result = await this.registerSubscription(followerId, followingId);
		await this.memberService.memberStatusEditor({
			_id: followerId,
			targetKey: 'memberFollowings',
			modifier: 1,
		});
		await this.memberService.memberStatusEditor({
			_id: followingId,
			targetKey: 'memberFollowers',
			modifier: 1,
		});

		return result;
	}

	private async registerSubscription(followerId: ObjectId, followingId: ObjectId): Promise<Follower> {
		try {
			return await this.followModel.create({ followingId, followerId });
		} catch (err) {
			console.error('Error, FollowService.registerSubscription:', err);
			throw new BadGatewayException(Message.CREATE_FAILED);
		}
	}

	public async unsubscribe(followerId: ObjectId, followingId: ObjectId): Promise<Follower> {
		const targetMember = await this.memberService.getMember(null, followingId);
		if (!targetMember) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const result = await this.followModel
			.findOneAndDelete({ followingId, followerId })
			.exec();
		if (!result) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		await this.memberService.memberStatusEditor({
			_id: followerId,
			targetKey: 'memberFollowings',
			modifier: -1,
		});
		await this.memberService.memberStatusEditor({
			_id: followingId,
			targetKey: 'memberFollowers',
			modifier: -1,
		});

		return result;
	}

	public async checkFollowExistence(followerId: ObjectId, followingId: ObjectId): Promise<MeFollowed[]> {
		if (!followerId) return [];

		const exist = await this.followModel.findOne({ followerId, followingId }).lean().exec();
		if (!exist) return [];

		return [{ followingId, followerId, myFollowing: true }];
	}

	public async getMemberFollowings(viewerId: ObjectId, input: FollowInquiry): Promise<Followings> {
		const { page, limit, search } = input;
		if (!search?.followerId) throw new InternalServerErrorException(Message.BAD_REQUEST);

		const match: T = { followerId: search.followerId };
		console.log('match:', match);

		const result = await this.followModel
			.aggregate([
				{ $match: match },
				{ $sort: { createdAt: Direction.DESC } },
				{
					$facet: {
						list: [
							{ $skip: (page - 1) * limit },
							{ $limit: limit },
							lookupFollowingData,
							{ $unwind: '$followingData' },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		if (result[0].list?.length) {
			result[0].list = await Promise.all(
				result[0].list.map(async (following: Following) => {
					following.meLiked = await this.likeService.checkLikeExistence({
						memberId: viewerId,
						likeRefId: following.followingId,
						likeGroup: LikeGroup.MEMBER,
					});
					following.meFollowed = await this.checkFollowExistence(viewerId, following.followingId);
					return following;
				}),
			);
		}

		return result[0];
	}

	public async getMemberFollowers(viewerId: ObjectId, input: FollowInquiry): Promise<Followers> {
		const { page, limit, search } = input;
		if (!search?.followingId) throw new InternalServerErrorException(Message.BAD_REQUEST);

		const match: T = { followingId: search.followingId };
		console.log('match:', match);

		const result = await this.followModel
			.aggregate([
				{ $match: match },
				{ $sort: { createdAt: Direction.DESC } },
				{
					$facet: {
						list: [
							{ $skip: (page - 1) * limit },
							{ $limit: limit },
							lookupFollowerData,
							{ $unwind: '$followerData' },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		if (result[0].list?.length) {
			result[0].list = await Promise.all(
				result[0].list.map(async (follower: Follower) => {
					follower.meLiked = await this.likeService.checkLikeExistence({
						memberId: viewerId,
						likeRefId: follower.followerId,
						likeGroup: LikeGroup.MEMBER,
					});
					follower.meFollowed = await this.checkFollowExistence(viewerId, follower.followerId);
					return follower;
				}),
			);
		}

		return result[0];
	}
}

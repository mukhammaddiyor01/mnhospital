import { BadGatewayException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Direction, Message } from '../../libs/enums/common.enum';
import {
	lookupAuthMemberFollowed,
	lookupAuthMemberLiked,
	lookupFollowerData,
	lookupFollowingData,
} from '../../libs/config';
import { T } from '../../libs/types/common';
import { LikeGroup } from '../like/enums/like.enum';
import { MemberService } from '../member/member.service';
import { DoctorService } from '../doctor/doctor.service';
import { MemberType } from '../member/enums/member.enum';
import { Follower, Followers, Following, Followings } from './dto/follow';
import { FollowInquiry } from './dto/follow.input';

@Injectable()
export class FollowService {
	constructor(
		@InjectModel('Follow') private readonly followModel: Model<Follower | Following>,
		private readonly memberService: MemberService,
		private readonly doctorService: DoctorService,
	) {}

	public async subscribe(followerId: ObjectId, followingId: ObjectId, memberType: MemberType): Promise<Follower> {
		if (followerId.toString() === followingId.toString()) {
			throw new BadGatewayException(Message.SELF_FOLLOW_DENIED);
		}

		const targetMember = await this.memberService.getMember(null, followingId);
		if (!targetMember) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const result = await this.registerSubscription(followerId, followingId);
		if (memberType === MemberType.DOCTOR) await this.doctorService.doctorStatisticEditor({ _id: followerId, targetKey: 'docFollowings', modifier: 1 });
		else await this.memberService.memberStatusEditor({ _id: followerId, targetKey: 'memberFollowings', modifier: 1 });
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

	public async unsubscribe(followerId: ObjectId, followingId: ObjectId, memberType: MemberType): Promise<Follower> {
		const targetMember = await this.memberService.getMember(null, followingId);
		if (!targetMember) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const result = await this.followModel
			.findOneAndDelete({ followingId, followerId })
			.exec();
		if (!result) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		if (memberType === MemberType.DOCTOR) await this.doctorService.doctorStatisticEditor({ _id: followerId, targetKey: 'docFollowings', modifier: -1 });
		else await this.memberService.memberStatusEditor({ _id: followerId, targetKey: 'memberFollowings', modifier: -1 });
		await this.memberService.memberStatusEditor({
			_id: followingId,
			targetKey: 'memberFollowers',
			modifier: -1,
		});

		return result;
	}

	public async getMemberFollowings(viewerId: ObjectId, input: FollowInquiry): Promise<Followings> {
		const { page, limit, search } = input;
		if (!search?.followerId) {
			throw new InternalServerErrorException(Message.BAD_REQUEST);
		}

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
							...(viewerId ? [lookupAuthMemberLiked(viewerId, '$followingId', LikeGroup.MEMBER)] : []),
							...(viewerId
								? [
										lookupAuthMemberFollowed({
											followerId: viewerId,
											followingId: '$followingId',
										}),
									]
								: []),
							lookupFollowingData,
							{ $unwind: '$followingData' },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		return result[0];
	}

	public async getMemberFollowers(viewerId: ObjectId, input: FollowInquiry): Promise<Followers> {
		const { page, limit, search } = input;
		if (!search?.followingId) {
			throw new InternalServerErrorException(Message.BAD_REQUEST);
		}

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
							...(viewerId ? [lookupAuthMemberLiked(viewerId, '$followerId', LikeGroup.MEMBER)] : []),
							...(viewerId
								? [
										lookupAuthMemberFollowed({
											followerId: viewerId,
											followingId: '$followerId',
										}),
									]
								: []),
							lookupFollowerData,
							{ $unwind: { path: '$followerData', preserveNullAndEmptyArrays: true } },
							{ $lookup: { from: 'doctors', localField: 'followerId', foreignField: '_id', as: 'followerDoctorData' } },
							{ $unwind: { path: '$followerDoctorData', preserveNullAndEmptyArrays: true } },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		return result[0];
	}
}

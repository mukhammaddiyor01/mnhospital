import { BadGatewayException, BadRequestException, forwardRef, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Direction, Message } from '../../../libs/enums/common.enum';
import { lookupAuthMemberLiked } from '../../../libs/config';
import { T } from '../../../libs/types/common';
import { LikeGroup } from '../../like/enums/like.enum';
import { MemberService } from '../../member/member.service';
import { MemberType } from '../../member/enums/member.enum';
import { DoctorService } from '../doctor.service';
import {
	DoctorFollower,
	DoctorFollowers,
	DoctorFollowing,
	DoctorFollowings,
	DoctorMeFollowed,
} from './dto/doctorFollow';
import { DoctorFollowInquiry } from './dto/doctorFollow.input';

@Injectable()
export class DoctorFollowService {
	constructor(
		@InjectModel('DoctorFollow') private readonly doctorFollowModel: Model<DoctorFollower | DoctorFollowing>,
		@Inject(forwardRef(() => DoctorService)) private readonly doctorService: DoctorService,
		private readonly memberService: MemberService,
	) {}

	public async subscribeDoctor(memberId: ObjectId, doctorId: ObjectId, memberType: MemberType): Promise<DoctorFollowing> {
		if (memberId.toString() === doctorId.toString()) throw new BadGatewayException(Message.SELF_FOLLOW_DENIED);
		const targetDoctor = await this.doctorService.findPublicDoctor(doctorId);
		if (!targetDoctor || targetDoctor.memberStatus !== 'ACTIVE') throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const existing = await this.doctorFollowModel.findOne({ doctorId, memberId }).exec();
		if (existing) return existing as DoctorFollowing;

		let result: DoctorFollowing;
		try { result = await this.doctorFollowModel.create({ doctorId, memberId }) as DoctorFollowing; }
		catch (error) {
			if (error?.code === 11000) {
				const existing = await this.doctorFollowModel.findOne({ doctorId, memberId }).exec();
				if (existing) return existing as DoctorFollowing;
			}
			throw new BadRequestException('Following could not be saved. Please try again.');
		}
		if (memberType === MemberType.DOCTOR) await this.doctorService.doctorStatisticEditor({ _id: memberId, targetKey: 'docFollowings', modifier: 1 });
		else await this.memberService.memberStatisticEditor({ _id: memberId, targetKey: 'memberFollowings', modifier: 1 });
		await this.doctorService.doctorStatisticEditor({
			_id: doctorId,
			targetKey: 'docFollowers',
			modifier: 1,
		});

		return result;
	}

	public async unsubscribeDoctor(memberId: ObjectId, doctorId: ObjectId, memberType: MemberType): Promise<DoctorFollowing> {
		const targetDoctor = await this.doctorService.findPublicDoctor(doctorId);
		if (!targetDoctor) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const result = await this.doctorFollowModel.findOneAndDelete({ doctorId, memberId }).exec();
		if (!result) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		if (memberType === MemberType.DOCTOR) await this.doctorService.doctorStatisticEditor({ _id: memberId, targetKey: 'docFollowings', modifier: -1 });
		else await this.memberService.memberStatisticEditor({ _id: memberId, targetKey: 'memberFollowings', modifier: -1 });
		await this.doctorService.doctorStatisticEditor({
			_id: doctorId,
			targetKey: 'docFollowers',
			modifier: -1,
		});

		return result;
	}

	private async checkDoctorFollowExistence(memberId: ObjectId, doctorId: ObjectId): Promise<DoctorMeFollowed[]> {
		if (!memberId) return [];

		const exist = await this.doctorFollowModel.findOne({ doctorId, memberId }).lean().exec();
		if (!exist) return [];

		return [{ doctorId, memberId, myFollowing: true }];
	}

	public async getDoctorFollowings(viewerId: ObjectId, input: DoctorFollowInquiry): Promise<DoctorFollowings> {
		const { page, limit, search } = input;
		if (!search?.memberId) throw new InternalServerErrorException(Message.BAD_REQUEST);

		const match: T = { memberId: search.memberId };
		const result = await this.doctorFollowModel
			.aggregate([
				{ $match: match },
				{ $sort: { createdAt: Direction.DESC } },
				{
					$facet: {
						list: [
							{ $skip: (page - 1) * limit },
							{ $limit: limit },
							...(viewerId ? [lookupAuthMemberLiked(viewerId, '$doctorId', LikeGroup.DOCTOR)] : []),
							{
								$lookup: {
									from: 'doctors',
									localField: 'doctorId',
									foreignField: '_id',
									as: 'doctorData',
								},
							},
							{ $unwind: '$doctorData' },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		if (result[0].list?.length) {
			result[0].list = await Promise.all(
				result[0].list.map(async (following: DoctorFollowing) => {
					following.meFollowed = await this.checkDoctorFollowExistence(viewerId, following.doctorId);
					return following;
				}),
			);
		}

		return result[0];
	}

	public async getDoctorFollowers(viewerId: ObjectId, input: DoctorFollowInquiry): Promise<DoctorFollowers> {
		const { page, limit, search } = input;
		if (!search?.doctorId) throw new InternalServerErrorException(Message.BAD_REQUEST);

		const match: T = { doctorId: search.doctorId };
		const result = await this.doctorFollowModel
			.aggregate([
				{ $match: match },
				{ $sort: { createdAt: Direction.DESC } },
				{
					$facet: {
						list: [
							{ $skip: (page - 1) * limit },
							{ $limit: limit },
							...(viewerId ? [lookupAuthMemberLiked(viewerId, '$memberId', LikeGroup.MEMBER)] : []),
							{
								$lookup: {
									from: 'members',
									localField: 'memberId',
									foreignField: '_id',
									as: 'memberData',
								},
							},
							{ $unwind: { path: '$memberData', preserveNullAndEmptyArrays: true } },
							{ $lookup: { from: 'doctors', localField: 'memberId', foreignField: '_id', as: 'followerDoctorData' } },
							{ $unwind: { path: '$followerDoctorData', preserveNullAndEmptyArrays: true } },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		if (result[0].list?.length) {
			result[0].list = await Promise.all(
				result[0].list.map(async (follower: DoctorFollower) => {
					follower.meFollowed = await this.checkDoctorFollowExistence(viewerId, follower.doctorId);
					return follower;
				}),
			);
		}

		return result[0];
	}
}

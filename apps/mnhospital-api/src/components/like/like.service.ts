import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Like, MeLiked } from './dto/like';
import { LikeInput } from './dto/like.input';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Message } from '../../libs/enums/common.enum';
import { T } from '../../libs/types/common';
import { LikeGroup } from './enums/like.enum';
import { Services } from '../service/dto/service';
import { OrdinaryInquiry } from '../service/dto/service.input';
import { lookupFavoriteService, lookupFavoriteServiceDoctor } from '../../libs/config';

@Injectable()
export class LikeService {
	constructor(@InjectModel('Like') private readonly likeModel: Model<Like>) {}

	public async toggleLike(input: LikeInput): Promise<number> {
		if (!input.memberId) throw new BadRequestException(Message.NOT_AUTHENTICATED);

		const search: T = {
			memberId: input.memberId as ObjectId,
			likeRefId: input.likeRefId,
			likeGroup: input.likeGroup,
		};

		// Only the request that actually deletes a record decrements its counter.
		const removed = await this.likeModel.findOneAndDelete(search).exec();
		if (removed) return -1;
		try {
			await this.likeModel.create(input);
			return 1;
		} catch (error) {
			// A simultaneous like already created the same unique relation.
			if (error?.code === 11000 && await this.likeModel.exists(search)) return 0;
			throw new BadRequestException('Like could not be saved. Please try again.');
		}
	}

	public async checkLikeExistence(input: LikeInput): Promise<MeLiked[]> {
		if (!input.memberId) return [];

		const search: T = {
			memberId: input.memberId,
			likeRefId: input.likeRefId,
			likeGroup: input.likeGroup,
		};
		const liked = await this.likeModel.findOne(search).lean().exec();

		if (!liked) return [];
		return [
			{
				memberId: input.memberId as ObjectId,
				likeRefId: input.likeRefId,
				myFavorite: true,
			},
		];
	}

	public async getFavoriteServices(memberId: ObjectId, input: OrdinaryInquiry): Promise<Services> {
		const { page, limit } = input;
		const match: T = { likeGroup: LikeGroup.SERVICE, memberId };

		const data: T[] = await this.likeModel
			.aggregate([
				{ $match: match },
				{ $sort: { updatedAt: -1 } },
				lookupFavoriteService,
				{ $unwind: '$favoriteService' },
				{
					$facet: {
						list: [
							{ $skip: (page - 1) * limit },
							{ $limit: limit },
							lookupFavoriteServiceDoctor,
							{
								$unwind: {
									path: '$favoriteService.memberData',
									preserveNullAndEmptyArrays: true,
								},
							},
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		const result: Services = {
			list: data[0]?.list?.map((item: T) => item.favoriteService) ?? [],
			metaCounter: data[0]?.metaCounter ?? [],
		};

		return result;
	}
}

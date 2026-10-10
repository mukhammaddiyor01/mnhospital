import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { View } from './dto/view';
import { ViewInput } from './dto/view.input';
import { T } from '../../libs/types/common';
import { ViewGroup } from './enums/view.enum';
import { lookupVisitedService, lookupVisitedServiceDoctor } from '../../libs/config';
import { Services } from '../service/dto/service';
import { OrdinaryInquiry } from '../service/dto/service.input';

@Injectable()
export class ViewService {
	constructor(@InjectModel('View') private readonly viewModel: Model<View>) {}

	public async recordView(input: ViewInput): Promise<View | null> {
		if (!input.memberId) return null;
		const { memberId, viewRefId, viewGroup } = input;
		const now = new Date(), id = new Types.ObjectId();
		try {
			const previous = await this.viewModel.findOneAndUpdate(
				{ memberId, viewRefId, viewGroup },
				{ $set: { updatedAt: now }, $setOnInsert: { _id: id, memberId, viewRefId, viewGroup } },
				{ upsert: true, new: false },
			).lean().exec();
			return previous ? null : { _id: id, memberId, viewRefId, viewGroup, createdAt: now };
		} catch (error) {
			if (error?.code === 11000 && await this.viewModel.exists({ memberId, viewRefId, viewGroup })) return null;
			throw error;
		}
	}

	public async getVisitedServices(memberId: ObjectId, input: OrdinaryInquiry): Promise<Services> {
		const { page, limit } = input;
		const match: T = { viewGroup: ViewGroup.SERVICE, memberId };

		const data: T[] = await this.viewModel
			.aggregate([
				{ $match: match },
				{ $addFields: { lastViewedAt: { $ifNull: ['$updatedAt', '$createdAt'] } } },
				{ $sort: { lastViewedAt: -1 } },
				lookupVisitedService,
				{ $unwind: '$visitedService' },
				{
					$facet: {
						list: [
							{ $skip: (page - 1) * limit },
							{ $limit: limit },
							lookupVisitedServiceDoctor,
							{
								$unwind: {
									path: '$visitedService.memberData',
									preserveNullAndEmptyArrays: true,
								},
							},
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		return {
			list: data[0]?.list?.map((item: T) => item.visitedService) ?? [],
			metaCounter: data[0]?.metaCounter ?? [],
		};
	}
}

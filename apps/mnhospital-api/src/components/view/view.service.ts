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
		const viewExist = await this.checkViewExistence(input);
		if (!viewExist) {
			console.log('_ New View Insert _');
			return await this.viewModel.create(input);
		} else return null;
	}

	private async checkViewExistence(input: ViewInput): Promise<View | null> {
		const { memberId, viewRefId, viewGroup } = input;
		const search: T = { memberId, viewRefId, viewGroup };
		return await this.viewModel.findOne(search).exec();
	}

	public async getVisitedServices(memberId: ObjectId, input: OrdinaryInquiry): Promise<Services> {
		const { page, limit } = input;
		const match: T = { viewGroup: ViewGroup.SERVICE, memberId };

		const data: T[] = await this.viewModel
			.aggregate([
				{ $match: match },
				{ $sort: { createdAt: -1 } },
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

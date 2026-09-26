import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Advertisement, Advertisements } from './dto/advertisement';
import { AdvertisementInput, AdvertisementsInquiry } from './dto/advertisement.input';
import { AdvertisementStatus } from './enums/advertisement.enum';
import { Message } from '../../libs/enums/common.enum';

@Injectable()
export class AdvertisementService {
	constructor(@InjectModel('Advertisement') private readonly advertisementModel: Model<Advertisement>) {}

	public async createAdvertisement(memberId: ObjectId, input: AdvertisementInput): Promise<Advertisement> {
		if (input.advertisementStatus === AdvertisementStatus.ARCHIVED) {
			throw new BadRequestException('A new advertisement cannot be created as archived');
		}

		try {
			return await this.advertisementModel.create({ ...input, createdByMemberId: memberId });
		} catch (err) {
			console.error('Error, AdvertisementService.createAdvertisement:', err);
			throw new BadRequestException(Message.CREATE_FAILED);
		}
	}

	public async getAdvertisements(input: AdvertisementsInquiry): Promise<Advertisements> {
		const result = await this.advertisementModel
			.aggregate([
				{ $match: { advertisementStatus: AdvertisementStatus.PUBLISHED } },
				{ $sort: { createdAt: -1 } },
				{
					$facet: {
						list: [{ $skip: (input.page - 1) * input.limit }, { $limit: input.limit }],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		return result[0];
	}
}

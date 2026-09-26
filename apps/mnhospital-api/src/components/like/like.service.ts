import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Like } from './dto/like';
import { LikeInput } from './dto/like.input';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Message } from '../../libs/enums/common.enum';
import { T } from '../../libs/types/common';

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

		const exist = await this.likeModel.findOne(search).exec();
		let modifier: number;

		if (exist) {
			await this.likeModel.findOneAndDelete(search).exec();
			modifier = -1;
		} else {
			try {
				await this.likeModel.create(input);
				modifier = 1;
			} catch (err) {
				console.error('Error, LikeService.toggleLike:', err);
				throw new BadRequestException(Message.CREATE_FAILED);
			}
		}

		console.log(`- Like modifier ${modifier} -`);
		return modifier;
	}
}

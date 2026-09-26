import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Article, Articles } from './dto/article';
import { ArticleInput, ArticlesInquiry } from './dto/article.input';
import { ArticleUpdate } from './dto/article.update';
import { ArticleStatus } from './enums/article.enum';
import { Direction, Message } from '../../libs/enums/common.enum';
import { StatisticModifier, T } from '../../libs/types/common';
import { lookupDoctor, shapeIntoMongoObjectId } from '../../libs/config';
import { ViewGroup } from '../view/enums/view.enum';
import { ViewService } from '../view/view.service';
import { DoctorService } from '../doctor/doctor.service';

@Injectable()
export class ArticleService {
	constructor(
		@InjectModel('Article') private readonly articleModel: Model<Article>,
		private readonly doctorService: DoctorService,
		private readonly viewService: ViewService,
	) {}

	public async createArticle(memberId: ObjectId, input: ArticleInput): Promise<Article> {
		if (input.articleStatus === ArticleStatus.ARCHIVED) {
			throw new BadRequestException('A new article cannot be created as archived');
		}

		try {
			const result = await this.articleModel.create({ ...input, memberId });
			try {
				await this.doctorService.doctorStatisticEditor({
					_id: memberId,
					targetKey: 'docArticles',
					modifier: 1,
				});
			} catch (err) {
				await this.articleModel.deleteOne({ _id: result._id }).exec();
				throw err;
			}
			return result;
		} catch (err) {
			console.error('Error, ArticleService.createArticle:', err);
			throw new BadRequestException(Message.CREATE_FAILED);
		}
	}

	public async getArticle(memberId: ObjectId, articleId: ObjectId): Promise<Article> {
		const search: T = {
			_id: articleId,
			articleStatus: ArticleStatus.PUBLISHED,
		};

		const targetArticle: Article = await this.articleModel.findOne(search).lean().exec();
		if (!targetArticle) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		if (memberId) {
			const viewInput = { memberId, viewRefId: articleId, viewGroup: ViewGroup.ARTICLE };
			const newView = await this.viewService.recordView(viewInput);
			if (newView) {
				await this.articleStatsEditor({ _id: articleId, targetKey: 'articleViews', modifier: 1 });
				targetArticle.articleViews = (targetArticle.articleViews ?? 0) + 1;
			}
		}

		targetArticle.memberData = await this.doctorService.getDoctor(targetArticle.memberId);
		return targetArticle;
	}

	public async updateArticle(memberId: ObjectId, input: ArticleUpdate): Promise<Article> {
		const { _id, articleStatus } = input;
		const updateData: T = { ...input };
		delete updateData._id;

		const result = await this.articleModel
			.findOneAndUpdate(
				{
					_id,
					memberId,
					articleStatus: { $ne: ArticleStatus.ARCHIVED },
				},
				{ $set: updateData },
				{ new: true, runValidators: true },
			)
			.exec();

		if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);

		if (articleStatus === ArticleStatus.ARCHIVED) {
			await this.doctorService.doctorStatisticEditor({
				_id: memberId,
				targetKey: 'docArticles',
				modifier: -1,
			});
		}

		return result;
	}

	public async getArticles(_memberId: ObjectId, input: ArticlesInquiry): Promise<Articles> {
		const match: T = { articleStatus: ArticleStatus.PUBLISHED };
		const { memberId: searchMemberId, articleCategoryList, periodsRange, text } = input.search;

		if (searchMemberId) match.memberId = shapeIntoMongoObjectId(searchMemberId);
		if (articleCategoryList) match.articleCategory = { $in: articleCategoryList };
		if (periodsRange) match.createdAt = { $gte: periodsRange.start, $lte: periodsRange.end };
		if (text) {
			const searchRegex = new RegExp(text, 'i');
			match.$or = [{ articleTitle: searchRegex }, { articleContent: searchRegex }];
		}

		const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };
		const result = await this.articleModel
			.aggregate([
				{ $match: match },
				{ $sort: sort },
				{
					$facet: {
						list: [
							{ $skip: (input.page - 1) * input.limit },
							{ $limit: input.limit },
							lookupDoctor,
							{ $unwind: '$memberData' },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		return result[0];
	}

	public async articleStatsEditor(input: StatisticModifier): Promise<Article> {
		const { _id, targetKey, modifier } = input;
		return await this.articleModel
			.findByIdAndUpdate(_id, { $inc: { [targetKey]: modifier } }, { new: true })
			.exec();
	}
}

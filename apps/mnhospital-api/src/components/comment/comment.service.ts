import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Comment, Comments } from './dto/comment';
import { CommentInput, CommentsInquiry } from './dto/comment.input';
import { CommentUpdate } from './dto/comment.update';
import { CommentStatus } from './enums/comment.enum';
import { MemberService } from '../member/member.service';
import { ServiceService } from '../service/service.service';
import { ArticleService } from '../article/article.service';
import { Direction, Message } from '../../libs/enums/common.enum';
import { ReferenceGroup } from '../../libs/enums/reference.enum';
import { StatisticModifier, T } from '../../libs/types/common';
import { lookupMember, shapeIntoMongoObjectId } from '../../libs/config';

@Injectable()
export class CommentService {
	constructor(
		@InjectModel('Comment') private readonly commentModel: Model<Comment>,
		private readonly memberService: MemberService,
		private readonly serviceService: ServiceService,
		private readonly articleService: ArticleService,
	) {}

	public async createComment(memberId: ObjectId, input: CommentInput): Promise<Comment> {
		input.memberId = memberId;

		try {
			const result = await this.commentModel.create(input);
			try {
				await this.commentTargetStatsEditor(input.commentGroup, input.commentRefId, 1);
			} catch (err) {
				await this.commentModel.deleteOne({ _id: result._id }).exec();
				throw err;
			}
			return result;
		} catch (err) {
			console.error('Error, CommentService.createComment:', err);
			if (err instanceof BadRequestException) throw err;
			throw new BadRequestException(Message.CREATE_FAILED);
		}
	}

	public async updateComment(memberId: ObjectId, input: CommentUpdate): Promise<Comment> {
		const { _id } = input;
		const currentComment = await this.commentModel
			.findOne({ _id, memberId, commentStatus: { $ne: CommentStatus.DELETED } })
			.exec();
		if (!currentComment) throw new InternalServerErrorException(Message.UPDATE_FAILED);

		const updateData: T = { ...input };
		delete updateData._id;
		const result = await this.commentModel
			.findOneAndUpdate(
				{ _id, memberId, commentStatus: { $ne: CommentStatus.DELETED } },
				{ $set: updateData },
				{ new: true, runValidators: true },
			)
			.exec();
		if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);

		if (input.commentStatus === CommentStatus.DELETED) {
			try {
				await this.commentTargetStatsEditor(currentComment.commentGroup, currentComment.commentRefId, -1);
			} catch (err) {
				await this.commentModel
					.findByIdAndUpdate(currentComment._id, { $set: { commentStatus: currentComment.commentStatus } })
					.exec();
				throw err;
			}
		}

		return result;
	}

	public async getComments(memberId: ObjectId, input: CommentsInquiry): Promise<Comments> {
		const { commentRefId } = input.search;
		const match: T = { commentRefId: shapeIntoMongoObjectId(commentRefId), commentStatus: CommentStatus.ACTIVE };
		const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };

		const result = await this.commentModel
			.aggregate([
				{ $match: match },
				{ $sort: sort },
				{
					$facet: {
						list: [
							{ $skip: (input.page - 1) * input.limit },
							{ $limit: input.limit },
							lookupMember,
							{ $unwind: { path: '$memberData', preserveNullAndEmptyArrays: true } },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		return result[0];
	}

	private async commentTargetStatsEditor(
		commentGroup: ReferenceGroup,
		commentRefId: ObjectId,
		modifier: number,
	): Promise<void> {
		const input: StatisticModifier = { _id: commentRefId, targetKey: '', modifier };

		switch (commentGroup) {
			case ReferenceGroup.MEMBER:
				input.targetKey = 'memberComments';
				await this.memberService.memberStatisticEditor(input);
				return;
			case ReferenceGroup.SERVICE:
				input.targetKey = 'serviceComments';
				if (!(await this.serviceService.serviceStatsEditor(input))) {
					throw new InternalServerErrorException(Message.NO_DATA_FOUND);
				}
				return;
			case ReferenceGroup.ARTICLE:
				input.targetKey = 'articleComments';
				if (!(await this.articleService.articleStatsEditor(input))) {
					throw new InternalServerErrorException(Message.NO_DATA_FOUND);
				}
				return;
			default:
				throw new BadRequestException(Message.NOT_ALLOWED_REQUEST);
		}
	}
}

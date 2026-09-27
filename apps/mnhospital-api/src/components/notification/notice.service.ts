import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Message } from '../../libs/enums/common.enum';
import { MemberType } from '../member/enums/member.enum';
import { Notice, Notices } from './dto/notification';
import { NoticeCategory, NoticeStatus } from './enums/notification.enum';
import { NoticeInput, NoticeInquiry, NoticeUpdateInput } from './dto/notification.input';

@Injectable()
export class NoticeService {
	constructor(@InjectModel('Notice') private readonly noticeModel: Model<Notice>) {}

	public async createNotice(adminId: ObjectId, input: NoticeInput): Promise<Notice> {
		return await this.noticeModel.create({
			...input,
			noticeStatus: NoticeStatus.DRAFT,
			authorId: adminId,
			authorType: MemberType.ADMIN,
		});
	}

	public async getPublishedNotices(input: NoticeInquiry): Promise<Notices> {
		return this.getNotices({ ...input, noticeStatus: NoticeStatus.PUBLISHED });
	}

	public async getNoticesByAdmin(input: NoticeInquiry): Promise<Notices> {
		return this.getNotices(input);
	}

	public async updateNotice(input: NoticeUpdateInput): Promise<Notice> {
		const updateData: Record<string, unknown> = { ...input };
		delete updateData._id;

		const result = await this.noticeModel
			.findOneAndUpdate({ _id: input._id }, { $set: updateData }, { new: true, runValidators: true })
			.exec();
		if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);
		return result;
	}

	public async archiveNotice(noticeId: ObjectId): Promise<Notice> {
		const result = await this.noticeModel
			.findOneAndUpdate({ _id: noticeId }, { $set: { noticeStatus: NoticeStatus.ARCHIVED } }, { new: true })
			.exec();
		if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);
		return result;
	}

	private async getNotices(input: NoticeInquiry): Promise<Notices> {
		const match: Record<string, unknown> = {};
		if (input.noticeStatus) match.noticeStatus = input.noticeStatus;
		if (input.noticeCategory) match.noticeCategory = input.noticeCategory as NoticeCategory;

		const result = await this.noticeModel
			.aggregate([
				{ $match: match },
				{ $sort: { createdAt: -1 } },
				{
					$facet: {
						list: [{ $skip: (input.page - 1) * input.limit }, { $limit: input.limit }],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		return result[0] ?? { list: [], metaCounter: [] };
	}
}

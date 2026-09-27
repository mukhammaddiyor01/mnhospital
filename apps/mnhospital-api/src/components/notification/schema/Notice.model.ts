import { Schema } from 'mongoose';
import { MemberType } from '../../member/enums/member.enum';
import { NoticeCategory, NoticeStatus } from '../enums/notification.enum';

const NoticeSchema = new Schema(
	{
		noticeCategory: {
			type: String,
			enum: NoticeCategory,
			required: true,
		},
		noticeStatus: {
			type: String,
			enum: NoticeStatus,
			default: NoticeStatus.DRAFT,
		},
		noticeTitle: {
			type: String,
			required: true,
		},
		noticeContent: {
			type: String,
			required: true,
		},
		authorId: {
			type: Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		authorType: {
			type: String,
			enum: MemberType,
			default: MemberType.ADMIN,
			required: true,
		},
	},
	{ timestamps: true, collection: 'notices' },
);

NoticeSchema.index({ noticeStatus: 1, noticeCategory: 1, createdAt: -1 });

export default NoticeSchema;

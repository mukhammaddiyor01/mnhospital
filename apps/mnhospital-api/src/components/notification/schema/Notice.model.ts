import { Schema } from 'mongoose';
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
		memberId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
			index: true,
		},
	},
	{ timestamps: true, collection: 'notices' },
);

export default NoticeSchema;

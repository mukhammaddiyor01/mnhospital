import { Schema } from 'mongoose';
import { MemberType } from '../../member/enums/member.enum';
import { NotificationGroup, NotificationStatus, NotificationType } from '../enums/notification.enum';

const NotificationSchema = new Schema(
	{
		notificationType: {
			type: String,
			enum: NotificationType,
			required: true,
		},
		notificationStatus: {
			type: String,
			enum: NotificationStatus,
			default: NotificationStatus.UNREAD,
		},
		notificationGroup: {
			type: String,
			enum: NotificationGroup,
			required: true,
		},
		notificationTitle: {
			type: String,
			required: true,
			trim: true,
			maxlength: 150,
		},
		notificationDesc: {
			type: String,
			required: true,
			trim: true,
			maxlength: 2000,
		},
		authorId: {
			type: Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		authorType: {
			type: String,
			enum: MemberType,
			required: true,
		},
		receiverId: {
			type: Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		receiverType: {
			type: String,
			enum: MemberType,
			required: true,
		},
		notificationRefId: {
			type: Schema.Types.ObjectId,
			required: true,
		},
	},
	{ timestamps: true, collection: 'notification' },
);

NotificationSchema.index({ receiverId: 1, receiverType: 1, notificationStatus: 1, createdAt: -1 });
NotificationSchema.index({ receiverId: 1, receiverType: 1, createdAt: -1 });

export default NotificationSchema;

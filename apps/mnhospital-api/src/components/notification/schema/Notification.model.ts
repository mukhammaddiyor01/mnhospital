import { Schema } from 'mongoose';
import { ReferenceGroup } from '../../../libs/enums/reference.enum';
import { NotificationStatus, NotificationType } from '../enums/notification.enum';

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
			enum: ReferenceGroup,
			required: true,
		},
		notificationTitle: {
			type: String,
			required: true,
		},
		notificationDesc: {
			type: String,
			required: true,
		},
		authorId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
		},
		receiverId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
			index: true,
		},
		notificationRefId: {
			type: Schema.Types.ObjectId,
			required: true,
		},
	},
	{ timestamps: true, collection: 'notification' },
);

NotificationSchema.index({ receiverId: 1, notificationStatus: 1, createdAt: -1 });

export default NotificationSchema;

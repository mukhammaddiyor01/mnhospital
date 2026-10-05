import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { MemberType } from '../member/enums/member.enum';
import { Notification, Notifications } from './dto/notification';
import { NotificationGroup, NotificationStatus, NotificationType } from './enums/notification.enum';
import { NotificationInquiry } from './dto/notification.input';

export interface CreateNotificationData {
	notificationType: NotificationType;
	notificationStatus?: NotificationStatus;
	notificationGroup: NotificationGroup;
	notificationTitle: string;
	notificationDesc: string;
	authorId?: ObjectId;
	authorType?: MemberType;
	receiverId: ObjectId;
	receiverType: MemberType;
	notificationRefId: ObjectId;
}

@Injectable()
export class NotificationService {
	constructor(@InjectModel('Notification') private readonly notificationModel: Model<Notification>) {}

	public async createNotification(input: CreateNotificationData): Promise<Notification> {
		return await this.notificationModel.create({
			...input,
			notificationStatus: input.notificationStatus ?? NotificationStatus.UNREAD,
		});
	}

	public async createEventNotification(eventKey: string, input: CreateNotificationData): Promise<Notification> {
		try {
			return await this.notificationModel.findOneAndUpdate(
				{ notificationEventKey: eventKey },
				{ $setOnInsert: { ...input, notificationStatus: NotificationStatus.UNREAD, notificationEventKey: eventKey } },
				{ upsert: true, new: true, setDefaultsOnInsert: true },
			).exec();
		} catch (error) {
			if ((error as { code?: number }).code !== 11000) throw error;
			return this.notificationModel.findOne({ notificationEventKey: eventKey }).select('+notificationEventKey').exec();
		}
	}

	public async getMyNotifications(
		receiverId: ObjectId,
		receiverType: MemberType,
		input: NotificationInquiry,
	): Promise<Notifications> {
		const match: Record<string, unknown> = { receiverId, receiverType };
		if (input.notificationStatus) match.notificationStatus = input.notificationStatus;
		if (input.notificationType) match.notificationType = input.notificationType;
		if (input.notificationGroup) match.notificationGroup = input.notificationGroup;

		const result = await this.notificationModel
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

	public async getMyNotification(
		receiverId: ObjectId,
		receiverType: MemberType,
		notificationId: ObjectId,
	): Promise<Notification> {
		const notification = await this.notificationModel
			.findOne({ _id: notificationId, receiverId, receiverType })
			.exec();
		if (!notification) throw new NotFoundException('Notification not found');
		return notification;
	}

	public async markMyNotificationRead(
		receiverId: ObjectId,
		receiverType: MemberType,
		notificationId: ObjectId,
	): Promise<Notification> {
		const updated = await this.notificationModel
			.findOneAndUpdate(
				{ _id: notificationId, receiverId, receiverType, notificationStatus: NotificationStatus.UNREAD },
				{ $set: { notificationStatus: NotificationStatus.READ } },
				{ new: true },
			)
			.exec();
		return updated ?? this.getMyNotification(receiverId, receiverType, notificationId);
	}

	public async markAllMyNotificationsRead(receiverId: ObjectId, receiverType: MemberType): Promise<number> {
		const result = await this.notificationModel
			.updateMany(
				{ receiverId, receiverType, notificationStatus: NotificationStatus.UNREAD },
				{ $set: { notificationStatus: NotificationStatus.READ } },
			)
			.exec();
		return result.modifiedCount;
	}

	public async archiveMyNotification(
		receiverId: ObjectId,
		receiverType: MemberType,
		notificationId: ObjectId,
	): Promise<Notification> {
		const updated = await this.notificationModel
			.findOneAndUpdate(
				{ _id: notificationId, receiverId, receiverType, notificationStatus: { $ne: NotificationStatus.ARCHIVED } },
				{ $set: { notificationStatus: NotificationStatus.ARCHIVED } },
				{ new: true },
			)
			.exec();
		return updated ?? this.getMyNotification(receiverId, receiverType, notificationId);
	}
}

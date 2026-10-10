import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType } from '../member/enums/member.enum';
import { Notification, Notifications } from './dto/notification';
import { NotificationInquiry } from './dto/notification.input';
import { NotificationService } from './notification.service';

const notificationRoles = [MemberType.PATIENT, MemberType.DOCTOR, MemberType.RECEPTIONIST, MemberType.ADMIN];
const parseNotificationId = (notificationId: string): ObjectId => {
	if (!ObjectId.isValid(notificationId)) throw new BadRequestException('Invalid notification ID');
	return new ObjectId(notificationId);
};

@Resolver()
export class NotificationResolver {
	constructor(private readonly notificationService: NotificationService) {}

	@Roles(...notificationRoles)
	@UseGuards(RolesGuard)
	@Query(() => Int)
	public async getMyUnreadNotificationCount(
		@AuthMember() actor: { _id: ObjectId; memberType: MemberType },
	): Promise<number> {
		return this.notificationService.getUnreadCount(actor._id, actor.memberType);
	}

	@Roles(...notificationRoles)
	@UseGuards(RolesGuard)
	@Query(() => Notifications)
	public async getMyNotifications(
		@Args('input') input: NotificationInquiry,
		@AuthMember() authMember: { _id: ObjectId; memberType: MemberType },
	): Promise<Notifications> {
		console.log('Query: getMyNotifications');
		return await this.notificationService.getMyNotifications(authMember._id, authMember.memberType, input);
	}

	@Roles(...notificationRoles)
	@UseGuards(RolesGuard)
	@Query(() => Notification)
	public async getMyNotification(
		@Args('notificationId') notificationId: string,
		@AuthMember() authMember: { _id: ObjectId; memberType: MemberType },
	): Promise<Notification> {
		console.log('Query: getMyNotification');
		return await this.notificationService.getMyNotification(
			authMember._id,
			authMember.memberType,
			parseNotificationId(notificationId),
		);
	}

	@Roles(...notificationRoles)
	@UseGuards(RolesGuard)
	@Mutation(() => Notification)
	public async markMyNotificationRead(
		@Args('notificationId') notificationId: string,
		@AuthMember() authMember: { _id: ObjectId; memberType: MemberType },
	): Promise<Notification> {
		console.log('Mutation: markMyNotificationRead');
		return await this.notificationService.markMyNotificationRead(
			authMember._id,
			authMember.memberType,
			parseNotificationId(notificationId),
		);
	}

	@Roles(...notificationRoles)
	@UseGuards(RolesGuard)
	@Mutation(() => Int)
	public async markAllMyNotificationsRead(
		@AuthMember() authMember: { _id: ObjectId; memberType: MemberType },
	): Promise<number> {
		console.log('Mutation: markAllMyNotificationsRead');
		return await this.notificationService.markAllMyNotificationsRead(authMember._id, authMember.memberType);
	}

	@Roles(...notificationRoles)
	@UseGuards(RolesGuard)
	@Mutation(() => Notification)
	public async archiveMyNotification(
		@Args('notificationId') notificationId: string,
		@AuthMember() authMember: { _id: ObjectId; memberType: MemberType },
	): Promise<Notification> {
		console.log('Mutation: archiveMyNotification');
		return await this.notificationService.archiveMyNotification(
			authMember._id,
			authMember.memberType,
			parseNotificationId(notificationId),
		);
	}
}

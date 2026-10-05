import { Field, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { TotalCounter } from '../../member/dto/member';
import { MemberType } from '../../member/enums/member.enum';
import { NotificationGroup, NotificationStatus, NotificationType, NoticeCategory, NoticeStatus } from '../enums/notification.enum';

@ObjectType()
export class Notification {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => NotificationType)
	notificationType: NotificationType;

	@Field(() => NotificationStatus)
	notificationStatus: NotificationStatus;

	@Field(() => NotificationGroup)
	notificationGroup: NotificationGroup;

	@Field(() => String)
	notificationTitle: string;

	@Field(() => String)
	notificationDesc: string;

	@Field(() => String, { nullable: true })
	authorId?: ObjectId;

	@Field(() => MemberType, { nullable: true })
	authorType?: MemberType;

	@Field(() => String)
	receiverId: ObjectId;

	@Field(() => MemberType)
	receiverType: MemberType;

	@Field(() => String)
	notificationRefId: ObjectId;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}

@ObjectType()
export class Notifications {
	@Field(() => [Notification])
	list: Notification[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter?: TotalCounter[];
}

@ObjectType()
export class Notice {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => NoticeCategory)
	noticeCategory: NoticeCategory;

	@Field(() => NoticeStatus)
	noticeStatus: NoticeStatus;

	@Field(() => String)
	noticeTitle: string;

	@Field(() => String)
	noticeContent: string;

	@Field(() => String)
	authorId: ObjectId;

	@Field(() => MemberType)
	authorType: MemberType;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}

@ObjectType()
export class Notices {
	@Field(() => [Notice])
	list: Notice[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter?: TotalCounter[];
}

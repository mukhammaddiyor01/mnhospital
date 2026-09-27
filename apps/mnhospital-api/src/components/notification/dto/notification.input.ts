import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEnum, IsInstance, IsInt, IsNotEmpty, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { NotificationGroup, NotificationStatus, NotificationType, NoticeCategory, NoticeStatus } from '../enums/notification.enum';

const toObjectId = ({ value }: { value: unknown }) =>
	typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value;

@InputType()
export class NotificationInquiry {
	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 1 })
	page = 1;

	@IsInt()
	@Min(1)
	@Max(100)
	@Field(() => Int, { defaultValue: 10 })
	limit = 10;

	@IsOptional()
	@IsEnum(NotificationStatus)
	@Field(() => NotificationStatus, { nullable: true })
	notificationStatus?: NotificationStatus;

	@IsOptional()
	@IsEnum(NotificationType)
	@Field(() => NotificationType, { nullable: true })
	notificationType?: NotificationType;

	@IsOptional()
	@IsEnum(NotificationGroup)
	@Field(() => NotificationGroup, { nullable: true })
	notificationGroup?: NotificationGroup;
}

@InputType()
export class NoticeInput {
	@IsEnum(NoticeCategory)
	@IsNotEmpty()
	@Field(() => NoticeCategory)
	noticeCategory: NoticeCategory;

	@IsString()
	@IsNotEmpty()
	@Length(2, 150)
	@Field(() => String)
	noticeTitle: string;

	@IsString()
	@IsNotEmpty()
	@Length(2, 5000)
	@Field(() => String)
	noticeContent: string;
}

@InputType()
export class NoticeUpdateInput {
	@Transform(toObjectId)
	@IsInstance(ObjectId)
	@IsNotEmpty()
	@Field(() => String)
	_id: ObjectId;

	@IsOptional()
	@IsEnum(NoticeCategory)
	@Field(() => NoticeCategory, { nullable: true })
	noticeCategory?: NoticeCategory;

	@IsOptional()
	@IsEnum(NoticeStatus)
	@Field(() => NoticeStatus, { nullable: true })
	noticeStatus?: NoticeStatus;

	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@Length(2, 150)
	@Field(() => String, { nullable: true })
	noticeTitle?: string;

	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@Length(2, 5000)
	@Field(() => String, { nullable: true })
	noticeContent?: string;
}

@InputType()
export class NoticeInquiry {
	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 1 })
	page = 1;

	@IsInt()
	@Min(1)
	@Max(100)
	@Field(() => Int, { defaultValue: 10 })
	limit = 10;

	@IsOptional()
	@IsEnum(NoticeCategory)
	@Field(() => NoticeCategory, { nullable: true })
	noticeCategory?: NoticeCategory;

	@IsOptional()
	@IsEnum(NoticeStatus)
	@Field(() => NoticeStatus, { nullable: true })
	noticeStatus?: NoticeStatus;
}

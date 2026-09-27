import { registerEnumType } from '@nestjs/graphql';
import { MemberType } from '../../member/enums/member.enum';

export enum NotificationType {
	APPOINTMENT = 'APPOINTMENT',
	MESSAGE = 'MESSAGE',
	PAYMENT = 'PAYMENT',
	SYSTEM = 'SYSTEM',
}
registerEnumType(NotificationType, { name: 'NotificationType' });

export enum NotificationStatus {
	UNREAD = 'UNREAD',
	READ = 'READ',
	ARCHIVED = 'ARCHIVED',
}
registerEnumType(NotificationStatus, { name: 'NotificationStatus' });

export enum NotificationGroup {
	APPOINTMENT = 'APPOINTMENT',
	BOOKING_ORDER = 'BOOKING_ORDER',
	PAYMENT = 'PAYMENT',
	RECEPTION_TASK = 'RECEPTION_TASK',
	REPORT = 'REPORT',
	SYSTEM = 'SYSTEM',
}
registerEnumType(NotificationGroup, { name: 'NotificationGroup' });

export enum NoticeCategory {
	GENERAL = 'GENERAL',
	SYSTEM = 'SYSTEM',
	HEALTH = 'HEALTH',
	EVENT = 'EVENT',
}
registerEnumType(NoticeCategory, { name: 'NoticeCategory' });

export enum NoticeStatus {
	DRAFT = 'DRAFT',
	PUBLISHED = 'PUBLISHED',
	ARCHIVED = 'ARCHIVED',
}
registerEnumType(NoticeStatus, { name: 'NoticeStatus' });

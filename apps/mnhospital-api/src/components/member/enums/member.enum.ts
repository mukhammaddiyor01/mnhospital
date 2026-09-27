import { registerEnumType } from '@nestjs/graphql';

export enum MemberType {
	PATIENT = 'PATIENT',
	DOCTOR = 'DOCTOR',
	RECEPTIONIST = 'RECEPTIONIST',
	ADMIN = 'ADMIN',
}
registerEnumType(MemberType, { name: 'MemberType' });

export enum MemberStatus {
	ACTIVE = 'ACTIVE',
	BLOCK = 'BLOCK',
	DELETE = 'DELETE',
}
registerEnumType(MemberStatus, { name: 'MemberStatus' });

export enum MemberAuthType {
	PHONE = 'PHONE',
	EMAIL = 'EMAIL',
	NAVER = 'NAVER',
	GOOGLE = 'GOOGLE',
	KAKAO = 'KAKAO',
}
registerEnumType(MemberAuthType, { name: 'MemberAuthType' });

export enum ConversationType {
	DIRECT = 'DIRECT',
	GROUP = 'GROUP',
	SUPPORT = 'SUPPORT',
}
registerEnumType(ConversationType, { name: 'ConversationType' });

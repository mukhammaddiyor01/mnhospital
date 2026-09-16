import { registerEnumType } from '@nestjs/graphql';

export enum ReferenceGroup {
	MEMBER = 'MEMBER',
	DOCTOR = 'DOCTOR',
	PATIENT = 'PATIENT',
	SERVICE = 'SERVICE',
	ARTICLE = 'ARTICLE',
	COMMENT = 'COMMENT',
	APPOINTMENT = 'APPOINTMENT',
}
registerEnumType(ReferenceGroup, { name: 'ReferenceGroup' });

export enum RecordStatus {
	ACTIVE = 'ACTIVE',
	INACTIVE = 'INACTIVE',
	DELETED = 'DELETED',
}
registerEnumType(RecordStatus, { name: 'RecordStatus' });

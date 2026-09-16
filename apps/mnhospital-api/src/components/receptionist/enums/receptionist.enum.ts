import { registerEnumType } from '@nestjs/graphql';

export enum ReceptionTaskType {
	CHECK_IN = 'CHECK_IN',
	PREPARE_ROOM = 'PREPARE_ROOM',
	CALL_PATIENT = 'CALL_PATIENT',
	ASSIST = 'ASSIST',
	OTHER = 'OTHER',
}
registerEnumType(ReceptionTaskType, { name: 'ReceptionTaskType' });

export enum ReceptionTaskPriority {
	LOW = 'LOW',
	MEDIUM = 'MEDIUM',
	HIGH = 'HIGH',
	URGENT = 'URGENT',
}
registerEnumType(ReceptionTaskPriority, { name: 'ReceptionTaskPriority' });

export enum ReceptionTaskStatus {
	PENDING = 'PENDING',
	ACCEPTED = 'ACCEPTED',
	IN_PROGRESS = 'IN_PROGRESS',
	COMPLETED = 'COMPLETED',
	CANCELLED = 'CANCELLED',
}
registerEnumType(ReceptionTaskStatus, { name: 'ReceptionTaskStatus' });

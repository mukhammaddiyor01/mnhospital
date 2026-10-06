import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum HospitalAssistantStatus {
	READY = 'READY',
	NOT_CONFIGURED = 'NOT_CONFIGURED',
	UNAVAILABLE = 'UNAVAILABLE',
	RATE_LIMITED = 'RATE_LIMITED',
}
registerEnumType(HospitalAssistantStatus, { name: 'HospitalAssistantStatus' });

@ObjectType()
export class HospitalAssistantReply {
	@Field(() => HospitalAssistantStatus)
	status: HospitalAssistantStatus;

	@Field(() => String, { nullable: true })
	text?: string;
}

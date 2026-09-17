import { registerEnumType } from '@nestjs/graphql';

export enum ViewGroup {
	MEMBER = 'MEMBER',
	DOCTOR = 'DOCTOR',
	PATIENT = 'PATIENT',
	SERVICE = 'SERVICE',
	ARTICLE = 'ARTICLE',
	COMMENT = 'COMMENT',
	APPOINTMENT = 'APPOINTMENT',
}

registerEnumType(ViewGroup, {
	name: 'ViewGroup',
});

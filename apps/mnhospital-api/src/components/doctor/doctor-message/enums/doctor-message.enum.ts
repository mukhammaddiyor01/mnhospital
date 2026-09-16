import { registerEnumType } from '@nestjs/graphql';

export enum DoctorConversationType {
	ADMIN = 'ADMIN',
	PATIENT = 'PATIENT',
	RECEPTIONIST = 'RECEPTIONIST',
}
registerEnumType(DoctorConversationType, { name: 'DoctorConversationType' });

import { registerEnumType } from '@nestjs/graphql';

export enum DoctorReportFollowUp {
	NONE = 'NONE',
	OPTIONAL = 'OPTIONAL',
	REQUIRED = 'REQUIRED',
}
registerEnumType(DoctorReportFollowUp, { name: 'DoctorReportFollowUp' });

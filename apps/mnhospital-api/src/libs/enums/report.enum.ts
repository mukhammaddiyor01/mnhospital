import { registerEnumType } from '@nestjs/graphql';

export enum ReportType {
	SPAM = 'SPAM',
	ABUSE = 'ABUSE',
	INACCURATE = 'INACCURATE',
	OTHER = 'OTHER',
}
registerEnumType(ReportType, { name: 'ReportType' });

export enum ReportStatus {
	PENDING = 'PENDING',
	REVIEWING = 'REVIEWING',
	RESOLVED = 'RESOLVED',
	REJECTED = 'REJECTED',
}
registerEnumType(ReportStatus, { name: 'ReportStatus' });

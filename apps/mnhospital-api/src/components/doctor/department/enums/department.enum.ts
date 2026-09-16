import { registerEnumType } from '@nestjs/graphql';

export enum DepartmentStatus {
	ACTIVE = 'ACTIVE',
	INACTIVE = 'INACTIVE',
}
registerEnumType(DepartmentStatus, { name: 'DepartmentStatus' });

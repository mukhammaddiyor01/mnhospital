import { registerEnumType } from '@nestjs/graphql';

export enum AdminType {
	ADMIN = 'ADMIN',
}
registerEnumType(AdminType, { name: 'AdminType' });

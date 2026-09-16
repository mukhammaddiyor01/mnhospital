import { registerEnumType } from '@nestjs/graphql';

export enum ServiceType {
	CONSULTATION = 'CONSULTATION',
	DIAGNOSTIC = 'DIAGNOSTIC',
	PROCEDURE = 'PROCEDURE',
	THERAPY = 'THERAPY',
	LABORATORY = 'LABORATORY',
}
registerEnumType(ServiceType, { name: 'ServiceType' });

export enum ServiceStatus {
	ACTIVE = 'ACTIVE',
	INACTIVE = 'INACTIVE',
	UNAVAILABLE = 'UNAVAILABLE',
}
registerEnumType(ServiceStatus, { name: 'ServiceStatus' });

export enum ServiceRoom {
	CLINIC = 'CLINIC',
	ONLINE = 'ONLINE',
	HOME = 'HOME',
}
registerEnumType(ServiceRoom, { name: 'ServiceRoom' });

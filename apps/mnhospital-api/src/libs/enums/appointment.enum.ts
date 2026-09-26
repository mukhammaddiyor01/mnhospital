import { registerEnumType } from '@nestjs/graphql';

export enum AppointmentStatus {
	PENDING = 'PENDING',
	CONFIRMED = 'CONFIRMED',
	IN_PROGRESS = 'IN_PROGRESS',
	ENDED = 'ENDED',
	COMPLETED = 'COMPLETED',
	CANCELLED = 'CANCELLED',
	NO_SHOW = 'NO_SHOW',
}
registerEnumType(AppointmentStatus, { name: 'AppointmentStatus' });

export enum RoomType {
	CONSULTATION = 'CONSULTATION',
	PROCEDURE = 'PROCEDURE',
	OPERATING = 'OPERATING',
	LABORATORY = 'LABORATORY',
	WAITING = 'WAITING',
}
registerEnumType(RoomType, { name: 'RoomType' });

export enum RoomStatus {
	AVAILABLE = 'AVAILABLE',
	OCCUPIED = 'OCCUPIED',
	MAINTENANCE = 'MAINTENANCE',
	INACTIVE = 'INACTIVE',
}
registerEnumType(RoomStatus, { name: 'RoomStatus' });

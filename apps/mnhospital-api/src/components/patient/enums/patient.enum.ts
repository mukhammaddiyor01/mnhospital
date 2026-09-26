import { registerEnumType } from '@nestjs/graphql';

export enum PatientBloodType {
	A_POSITIVE = 'A_POSITIVE',
	A_NEGATIVE = 'A_NEGATIVE',
	B_POSITIVE = 'B_POSITIVE',
	B_NEGATIVE = 'B_NEGATIVE',
	AB_POSITIVE = 'AB_POSITIVE',
	AB_NEGATIVE = 'AB_NEGATIVE',
	O_POSITIVE = 'O_POSITIVE',
	O_NEGATIVE = 'O_NEGATIVE',
}
registerEnumType(PatientBloodType, { name: 'PatientBloodType' });

export enum PatientGender {
	MALE = 'MALE',
	FEMALE = 'FEMALE',
	OTHER = 'OTHER',
}
registerEnumType(PatientGender, { name: 'PatientGender' });

export enum CartStatus {
	ACTIVE = 'ACTIVE',
	CHECKED_OUT = 'CHECKED_OUT',
	EXPIRED = 'EXPIRED',
	ABANDONED = 'ABANDONED',
}
registerEnumType(CartStatus, { name: 'CartStatus' });

export enum BookingOrderStatus {
	PENDING = 'PENDING',
	CONFIRMED = 'CONFIRMED',
	COMPLETED = 'COMPLETED',
	CANCELLED = 'CANCELLED',
}
registerEnumType(BookingOrderStatus, { name: 'BookingOrderStatus' });

export enum PaymentProvider {
	EXIMBAY = 'EXIMBAY',
	STRIPE = 'STRIPE',
	PAYME = 'PAYME',
	CLICK = 'CLICK',
	CASH = 'CASH',
}
registerEnumType(PaymentProvider, { name: 'PaymentProvider' });

export enum PaymentMethod {
	CARD = 'CARD',
	CASH = 'CASH',
	BANK_TRANSFER = 'BANK_TRANSFER',
}
registerEnumType(PaymentMethod, { name: 'PaymentMethod' });

export enum PaymentStatus {
	PENDING = 'PENDING',
	PAID = 'PAID',
	FAILED = 'FAILED',
	REFUNDED = 'REFUNDED',
	CANCELLED = 'CANCELLED',
}
registerEnumType(PaymentStatus, { name: 'PaymentStatus' });

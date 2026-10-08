import { BadRequestException } from '@nestjs/common';
import { clinicDate, clinicDayStart } from '../../libs/booking/clinic-time';
export interface ServiceAvailability { availabilityDates?: string[]; openedAt?: Date; closedAt?: Date; }
export function validateServiceAvailability(value: ServiceAvailability): void {
	if (value.availabilityDates !== undefined) {
		if (!Array.isArray(value.availabilityDates) || value.availabilityDates.length > 366)
			throw new BadRequestException('Select at most 366 service dates');
		for (const date of value.availabilityDates) clinicDayStart(date);
		if (new Set(value.availabilityDates).size !== value.availabilityDates.length)
			throw new BadRequestException('Service dates must be unique');
	}
	if (value.openedAt && value.closedAt && value.closedAt <= value.openedAt)
		throw new BadRequestException('Service closing time must follow opening time');
}
export function serviceAllowsDate(service: ServiceAvailability, date: string): boolean {
	clinicDayStart(date);
	return !service.availabilityDates?.length || service.availabilityDates.includes(date);
}
export function serviceAllowsInterval(service: ServiceAvailability, start: Date, end: Date): boolean {
	return serviceAllowsDate(service, clinicDate(start)) &&
		(!service.openedAt || start >= new Date(service.openedAt)) &&
		(!service.closedAt || end <= new Date(service.closedAt));
}

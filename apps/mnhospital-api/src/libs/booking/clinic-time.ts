import { BadRequestException } from '@nestjs/common';

// Doctor schedules use configured clinic wall time, independently of server and browser clocks.
const offsets = { 'Asia/Tashkent': 5, 'Asia/Seoul': 9, UTC: 0 };
export function clinicTimeZone(): string {
	const zone = process.env.CLINIC_TIME_ZONE || 'Asia/Tashkent';
	if (!(zone in offsets)) throw new BadRequestException('Clinic time zone must be Asia/Tashkent, Asia/Seoul or UTC');
	return zone;
}
export function clinicOffsetMillis(): number { return offsets[clinicTimeZone()] * 60 * 60 * 1000; }
export function clinicCurrency(): string {
	const currency = process.env.CLINIC_CURRENCY || 'UZS';
	if (!['UZS', 'KRW'].includes(currency)) throw new BadRequestException('Clinic currency must be UZS or KRW');
	return currency;
}
export function clinicDate(value: Date): string {
	return new Date(value.getTime() + clinicOffsetMillis()).toISOString().slice(0, 10);
}
export function clinicDayStart(value: string): Date {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Date must use YYYY-MM-DD');
	const result = new Date(new Date(`${value}T00:00:00Z`).getTime() - clinicOffsetMillis());
	if (!Number.isFinite(result.getTime()) || clinicDate(result) !== value) {
		throw new BadRequestException('Date must be a valid YYYY-MM-DD value');
	}
	return result;
}
export function appointmentSlotKeys(doctorId: string, patientId: string, roomId: string, start: Date, end: Date): string[] {
	const keys: string[] = [];
	for (let minute = Math.floor(start.getTime() / 60000); minute < Math.ceil(end.getTime() / 60000); minute++) {
		for (const resource of [`doctor:${doctorId}`, `patient:${patientId}`, `room:${roomId}`]) keys.push(`${resource}:${minute}`);
	}
	return keys;
}

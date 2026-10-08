import { clinicDayStart, clinicDate, appointmentSlotKeys } from './clinic-time';
describe('Clinic calendar and resource reservations', () => {
	it('handles midnight and invalid dates in Tashkent independently of server timezone', () => {
		expect(clinicDayStart('2026-10-08').toISOString()).toBe('2026-10-07T19:00:00.000Z');
		expect(clinicDate(new Date('2026-10-07T20:00:00Z'))).toBe('2026-10-08');
		for (const invalid of ['2026-02-30', '2026-13-01', '2026-1-01']) expect(() => clinicDayStart(invalid)).toThrow();
	});
	it('claims overlapping duration for each resource and keeps adjacent appointments separate', () => {
		const first = appointmentSlotKeys('d1', 'p1', 'r1', new Date('2026-11-01T04:00Z'), new Date('2026-11-01T04:30Z'));
		const overlap = appointmentSlotKeys('d1', 'p2', 'r2', new Date('2026-11-01T04:15Z'), new Date('2026-11-01T04:45Z'));
		const adjacent = appointmentSlotKeys('d1', 'p1', 'r1', new Date('2026-11-01T04:30Z'), new Date('2026-11-01T05:00Z'));
		expect(first).toHaveLength(90);
		expect(overlap.some((key) => first.includes(key))).toBe(true);
		expect(adjacent.some((key) => first.includes(key))).toBe(false);
	});
});

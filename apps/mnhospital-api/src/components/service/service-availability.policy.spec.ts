import { serviceAllowsDate, serviceAllowsInterval, validateServiceAvailability } from './service-availability.policy';
import { ServiceInput } from './dto/service.input';
import { ServiceUpdate } from './dto/service.update';
import { validateSync } from 'class-validator';
describe('Service date availability', () => {
 const original = process.env.CLINIC_TIME_ZONE;
 beforeEach(() => { process.env.CLINIC_TIME_ZONE = 'Asia/Seoul'; });
 afterAll(() => { if (original === undefined) delete process.env.CLINIC_TIME_ZONE; else process.env.CLINIC_TIME_ZONE = original; });
 it('preserves legacy and explicitly unrestricted services', () => {
  expect(serviceAllowsDate({}, '2030-11-14')).toBe(true);
  expect(serviceAllowsDate({ availabilityDates: [] }, '2030-11-14')).toBe(true);
 });
 it('permits selected dates only, independently of weekday scheduling', () => {
  const service = { availabilityDates: ['2030-11-13','2030-11-15','2030-11-18'] };
  for (const date of service.availabilityDates) expect(serviceAllowsDate(service,date)).toBe(true);
  expect(serviceAllowsDate(service,'2030-11-14')).toBe(false);
 });
 it.each(['2030-02-30','2030-13-01','2030-1-01','wrong'])('rejects invalid calendar date %s', date => {
  expect(() => validateServiceAvailability({ availabilityDates: [date] })).toThrow();
 });
 it('bounds unique dates and rejects null rather than silently enabling all days', () => {
  expect(() => validateServiceAvailability({ availabilityDates: ['2030-11-13','2030-11-13'] })).toThrow();
  expect(() => validateServiceAvailability({ availabilityDates: Array(367).fill('2030-11-13') })).toThrow();
  expect(() => validateServiceAvailability({ availabilityDates: null } as any)).toThrow();
 });
 it('uses clinic local date at the UTC midnight boundary and fits the whole service into its bounds', () => {
  const service = { availabilityDates: ['2030-11-13'], openedAt: new Date('2030-11-12T15:00Z'), closedAt: new Date('2030-11-12T16:00Z') };
  expect(serviceAllowsInterval(service, new Date('2030-11-12T15:00Z'), new Date('2030-11-12T15:30Z'))).toBe(true);
  expect(serviceAllowsInterval(service, new Date('2030-11-12T15:45Z'), new Date('2030-11-12T16:15Z'))).toBe(false);
  expect(() => validateServiceAvailability({ openedAt: service.closedAt, closedAt: service.openedAt })).toThrow();
 });
 it.each([ServiceInput, ServiceUpdate])('validates the optional date-array DTO', Dto => {
  const input = new Dto();
  input.availabilityDates = ['2030-11-13','2030-11-13'];
  expect(validateSync(input).some(error => error.property === 'availabilityDates')).toBe(true);
  input.availabilityDates = [];
  expect(validateSync(input).some(error => error.property === 'availabilityDates')).toBe(false);
 });
});

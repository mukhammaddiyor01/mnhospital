import {Types} from 'mongoose';
import {DoctorScheduleService} from './doctorSchedule.service';
const chain = (value: unknown) => { const q: any = {exec: jest.fn(async()=>value)}; q.lean=q.select=jest.fn(()=>q); return q; };
describe('Public booking date discovery',()=>{
 let service:any, schedules:any[], visits:any[], room:any;
 const doctorId=new Types.ObjectId(), serviceId=new Types.ObjectId();
 const input={doctorId,serviceId,month:'2026-10'};
 let api:DoctorScheduleService, appointmentModel:any;
 beforeEach(()=>{
  jest.useFakeTimers().setSystemTime(new Date('2026-10-10T00:00:00Z'));
  process.env.CLINIC_TIME_ZONE='Asia/Seoul';
  service={serviceDuration:'30',availabilityDates:['2026-10-13','2026-10-14','2026-10-20']};
  schedules=[{weekday:2,startTime:'09:00',endTime:'10:00',slotDurationMinutes:30}]; visits=[];room={_id:new Types.ObjectId()};
  appointmentModel={find:jest.fn(()=>chain(visits)),updateMany:jest.fn(()=>chain({}))};
  api=new DoctorScheduleService({find:jest.fn(()=>chain(schedules)),findOne:jest.fn(()=>chain(schedules[0]))} as never,
   {findOne:jest.fn(()=>chain({docRoom:'101'}))} as never,{findOne:jest.fn(()=>chain(service))} as never,
   appointmentModel,{findOne:jest.fn(()=>chain(room))} as never);
 });
 afterEach(()=>jest.useRealTimers());
 it('intersects clinic dates and weekday schedule with one appointment read',async()=>{
  expect(await api.getAvailableDates(input)).toEqual({dates:['2026-10-13','2026-10-20'],reason:'AVAILABLE'});
  expect(appointmentModel.find).toHaveBeenCalledTimes(1);
 });
 it('excludes completely booked days and respects a partial remaining slot',async()=>{
  visits=[{startsAt:new Date('2026-10-13T00:00:00Z'),endsAt:new Date('2026-10-13T01:00:00Z')},
   {startsAt:new Date('2026-10-20T00:00:00Z'),endsAt:new Date('2026-10-20T00:30:00Z')}];
  expect((await api.getAvailableDates(input)).dates).toEqual(['2026-10-20']);
  expect((await api.getAvailableSlots({...input,date:'2026-10-20'}))[0].startsAt.toISOString()).toBe('2026-10-20T00:30:00.000Z');
 });
 it('does not invent a schedule',async()=>{schedules=[];expect((await api.getAvailableDates(input)).reason).toBe('NO_SCHEDULE')});
 it('does not book a missing room',async()=>{room=null;expect((await api.getAvailableDates(input)).reason).toBe('NO_ROOM')});
 it('distinguishes expired and reversed legacy windows',async()=>{
  service.closedAt=new Date('2026-10-09');expect((await api.getAvailableDates(input)).reason).toBe('SERVICE_ENDED');
  service.openedAt=new Date('2026-10-12');expect((await api.getAvailableDates(input)).reason).toBe('INVALID_SERVICE_WINDOW');
 });
 it('requires the full service duration to fit around breaks and service window',async()=>{
  service.serviceDuration='60';schedules[0].breakStart='09:30';schedules[0].breakEnd='10:00';
  expect((await api.getAvailableDates(input)).dates).toEqual([]);
  delete schedules[0].breakStart;delete schedules[0].breakEnd;service.closedAt=new Date('2026-10-13T00:45:00Z');
  expect((await api.getAvailableDates(input)).dates).toEqual([]);
 });
 it('weekly services do not require explicitly selected dates and past dates stay unavailable',async()=>{
  service.availabilityDates=[];expect((await api.getAvailableDates(input)).dates).toEqual(['2026-10-13','2026-10-20','2026-10-27']);
 });
 it('rejects mismatched services and malformed months',async()=>{
  service=null;await expect(api.getAvailableDates(input)).rejects.toThrow('not available');
  await expect(api.getAvailableDates({...input,month:'2026-13'})).rejects.toThrow('Month');
 });
});

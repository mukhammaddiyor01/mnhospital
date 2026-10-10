import { discountedServicePrice } from '../../booking/pricing.policy';
import {
	ServiceAvailability,
	serviceAllowsDate,
	serviceAllowsInterval,
} from '../../service/service-availability.policy';
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { clinicCurrency, clinicDayStart, clinicOffsetMillis } from '../../../libs/booking/clinic-time';
import { Appointment } from '../../appointment/dto/appointment';
import { HospitalRoom } from '../../appointment/dto/room';
import { RoomStatus } from '../../../libs/enums/appointment.enum';
import { AppointmentStatus } from '../../../libs/enums/appointment.enum';
import { MemberStatus } from '../../member/enums/member.enum';
import { Service } from '../../service/dto/service';
import { ServiceStatus } from '../../service/enums/service.enum';
import { Doctor } from '../dto/doctor';
import { AvailableDoctorDates, AvailableDoctorSlot, DoctorSchedule } from './dto/doctor-schedule';
import { AvailableDoctorDatesInput, AvailableDoctorSlotsInput, DoctorScheduleInput } from './dto/doctor-schedule.input';

@Injectable()
export class DoctorScheduleService {
	constructor(
		@InjectModel('DoctorSchedule') private readonly scheduleModel: Model<DoctorSchedule>,
		@InjectModel('Doctor') private readonly doctorModel: Model<Doctor>,
		@InjectModel('Service') private readonly serviceModel: Model<Service>,
		@InjectModel('Appointment') private readonly appointmentModel: Model<Appointment>,
		@InjectModel('Room') private readonly roomModel?: Model<HospitalRoom>,
	) {}

	public async upsertMySchedule(doctorId: ObjectId, input: DoctorScheduleInput): Promise<DoctorSchedule> {
		await this.ensureActiveDoctor(doctorId);
		const timeRange = this.validateTimeRange(input);
		if (timeRange.workMinutes < input.slotDurationMinutes) {
			throw new BadRequestException('Slot duration cannot exceed the working interval');
		}

		const updateData: Record<string, unknown> = {
			doctorId,
			weekday: input.weekday,
			startTime: input.startTime,
			endTime: input.endTime,
			slotDurationMinutes: input.slotDurationMinutes,
		};
		if (input.isActive !== undefined) updateData.isActive = input.isActive;

		const update: Record<string, unknown> = { $set: updateData };
		if (input.breakStart && input.breakEnd) {
			updateData.breakStart = input.breakStart;
			updateData.breakEnd = input.breakEnd;
		} else {
			update.$unset = { breakStart: 1, breakEnd: 1 };
		}

		return await this.scheduleModel
			.findOneAndUpdate({ doctorId, weekday: input.weekday }, update, {
				new: true,
				upsert: true,
				runValidators: true,
				setDefaultsOnInsert: true,
			})
			.exec();
	}

	public async getDoctorSchedules(doctorId: ObjectId): Promise<DoctorSchedule[]> {
		await this.ensureActiveDoctor(doctorId);
		return await this.scheduleModel.find({ doctorId }).sort({ weekday: 1 }).exec();
	}

	public async getAvailableSlots(input: AvailableDoctorSlotsInput): Promise<AvailableDoctorSlot[]> {
		const doctor = await this.ensureActiveDoctor(input.doctorId);
		if (this.roomModel) {
			if (!doctor.docRoom) return [];
			const room = await this.roomModel
				.findOne({
					roomNumber: doctor.docRoom,
					roomStatus: RoomStatus.AVAILABLE,
					$or: [{assignedDoctorId: null}, {assignedDoctorId: input.doctorId}],
				})
				.select('_id')
				.lean()
				.exec();
			if (!room) return [];
		}
		let service = await this.serviceModel
			.findOne({
				_id: input.serviceId,
				memberId: input.doctorId,
				serviceStatus: ServiceStatus.ACTIVE,
				deletedAt: { $exists: false },
			})
			.lean()
			.exec();
		if (!service) throw new BadRequestException('The service is not available for this doctor');

		service = await this.packageAvailability(service);
		if (!service) return [];
		const serviceDuration = Number(service.serviceDuration);
		if (!Number.isInteger(serviceDuration) || serviceDuration <= 0 || serviceDuration > 1440) {
			throw new BadRequestException('Service duration must be a positive number');
		}

		const day = clinicDayStart(input.date);
		if (!serviceAllowsDate(service, input.date)) return [];
		const weekday = new Date(day.getTime() + clinicOffsetMillis()).getUTCDay();
		const schedule = await this.scheduleModel
			.findOne({ doctorId: input.doctorId, weekday, isActive: true })
			.lean()
			.exec();
		if (!schedule) return [];

		if (!Number.isInteger(schedule.slotDurationMinutes) || schedule.slotDurationMinutes < 1) throw new BadRequestException('Invalid schedule slot interval');
		const dayStart = day.getTime();
		const dayEnd = dayStart + 24 * 60 * 60 * 1000;
		await this.appointmentModel
			.updateMany(
				{appointmentStatus: AppointmentStatus.PENDING, holdExpiresAt: {$lte: new Date()}},
				{
					$set: {
						appointmentStatus: AppointmentStatus.CANCELLED,
						cancelledAt: new Date(),
						cancellationReason: 'Payment reservation expired',
						slotKeys: [],
					},
				},
			)
			.exec();
		const appointments = await this.appointmentModel
			.find({
				doctorId: input.doctorId,
				appointmentStatus: {
					$in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS],
				},
				startsAt: { $lt: new Date(dayEnd) },
				endsAt: { $gt: new Date(dayStart) },
			})
			.select('startsAt endsAt')
			.lean()
			.exec();

		return this.slotsForDay(service, schedule, appointments, day);
	}

	public async getAvailableDates(input: AvailableDoctorDatesInput): Promise<AvailableDoctorDates> {
		// One month, one appointment read. Never advertise dates based only on service selections.
		if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(input.month)) throw new BadRequestException('Month must use YYYY-MM');
		const day = clinicDayStart(`${input.month}-01`);
		const [year, month] = input.month.split('-').map(Number);
		const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
		const end = new Date(day.getTime() + days * 86400000);
		const doctor = await this.ensureActiveDoctor(input.doctorId);
		let service = await this.serviceModel
			.findOne({
				_id: input.serviceId,
				memberId: input.doctorId,
				serviceStatus: ServiceStatus.ACTIVE,
				deletedAt: { $exists: false },
			})
			.lean()
			.exec();
		if (!service) throw new BadRequestException('The service is not available for this doctor');
		service = await this.packageAvailability(service);
		if (!service) return { dates: [], reason: 'PACKAGE_UNAVAILABLE' };
		if (service.openedAt && service.closedAt && new Date(service.closedAt) <= new Date(service.openedAt)) {
			return {dates: [], reason: 'INVALID_SERVICE_WINDOW'};
		}
		if (service.closedAt && new Date(service.closedAt).getTime() <= Date.now()) return {dates: [], reason: 'SERVICE_ENDED'};
		if (this.roomModel) {
			const room =
				doctor.docRoom &&
				(await this.roomModel
					.findOne({
						roomNumber: doctor.docRoom,
						roomStatus: RoomStatus.AVAILABLE,
						$or: [{assignedDoctorId: null}, {assignedDoctorId: input.doctorId}],
					})
					.select('_id')
					.lean()
					.exec());
			if (!room) return {dates: [], reason: 'NO_ROOM'};
		}
		const schedules = await this.scheduleModel.find({doctorId: input.doctorId, isActive: true}).lean().exec();
		if (!schedules.length) return {dates: [], reason: 'NO_SCHEDULE'};
		await this.appointmentModel
			.updateMany(
				{appointmentStatus: AppointmentStatus.PENDING, holdExpiresAt: {$lte: new Date()}},
				{
					$set: {
						appointmentStatus: AppointmentStatus.CANCELLED,
						cancelledAt: new Date(),
						cancellationReason: 'Payment reservation expired',
						slotKeys: [],
					},
				},
			)
			.exec();
		const appointments = await this.appointmentModel
			.find({
				doctorId: input.doctorId,
				appointmentStatus: {
					$in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS],
				},
				startsAt: {$lt: end},
				endsAt: {$gt: day},
			})
			.select('startsAt endsAt')
			.lean()
			.exec();
		const dates: string[] = [];
		for (let n = 1; n <= days; n++) {
			const date = `${input.month}-${String(n).padStart(2, '0')}`;
			if (!serviceAllowsDate(service, date)) continue;
			const start = new Date(day.getTime() + (n - 1) * 86400000);
			const weekday = new Date(start.getTime() + clinicOffsetMillis()).getUTCDay();
			const schedule = schedules.find((row) => row.weekday === weekday);
			if (schedule && this.slotsForDay(service, schedule, appointments, start).length) dates.push(date);
		}
		return {dates, reason: dates.length ? 'AVAILABLE' : 'NO_DATES'};
	}

	private async packageAvailability(service) {
		if (!service.packageBaseServiceId || !service.packageItems?.length) return service;
		const ids = service.packageItems.map((item) => new Types.ObjectId(item.serviceId));
		const components = await this.serviceModel
			.find({
				_id: { $in: ids },
				memberId: service.memberId,
				serviceStatus: ServiceStatus.ACTIVE,
				deletedAt: { $exists: false },
				packageBaseServiceId: { $exists: false },
			})
			.lean()
			.exec();
		if (
			components.length !== ids.length ||
            components.some(item => item.serviceRoom !== service.serviceRoom) ||
            discountedServicePrice(service.servicePrice, service.serviceDiscountPercent, clinicCurrency()).total >= components.reduce((sum, item) => sum + discountedServicePrice(item.servicePrice, item.serviceDiscountPercent, clinicCurrency()).total, 0) ||
			components.reduce((sum, item) => sum + Number(item.serviceDuration), 0) > Number(service.serviceDuration)
		)
			return null;
		const dates = [service, ...components].map((item) => item.availabilityDates ?? []).filter((list) => list.length);
		const availabilityDates = dates.length
			? dates.reduce((common, list) => common.filter((date) => list.includes(date)))
			: [];
		if (dates.length && !availabilityDates.length) return null;
		const starts = [service, ...components]
			.map((item) => item.openedAt)
			.filter(Boolean)
			.map((value) => new Date(value).getTime());
		const ends = [service, ...components]
			.map((item) => item.closedAt)
			.filter(Boolean)
			.map((value) => new Date(value).getTime());
		const openedAt = starts.length ? new Date(Math.max(...starts)) : undefined;
		const closedAt = ends.length ? new Date(Math.min(...ends)) : undefined;
		if (openedAt && closedAt && closedAt <= openedAt) return null;
		return { ...service, availabilityDates, openedAt, closedAt };
	}

	private slotsForDay(
		service: ServiceAvailability & {serviceDuration?: string},
		schedule: DoctorSchedule,
		appointments: Array<{startsAt: Date; endsAt: Date}>,
		day: Date,
	): AvailableDoctorSlot[] {
		const serviceDuration = Number(service.serviceDuration);
		if (!Number.isInteger(serviceDuration) || serviceDuration < 1 || serviceDuration > 1440) {
			throw new BadRequestException('Service duration must be a positive number');
		}
		if (!Number.isInteger(schedule.slotDurationMinutes) || schedule.slotDurationMinutes < 1) {
			throw new BadRequestException('Invalid schedule slot interval');
		}
		const range = this.validateTimeRange(schedule);
		const dayStart = day.getTime();

		const slots: AvailableDoctorSlot[] = [];
		const workStart = dayStart + range.startMinutes * 60 * 1000;
		const workEnd = dayStart + range.endMinutes * 60 * 1000;
		const breakStart = range.breakStartMinutes === undefined ? undefined : dayStart + range.breakStartMinutes * 60 * 1000;
		const breakEnd = range.breakEndMinutes === undefined ? undefined : dayStart + range.breakEndMinutes * 60 * 1000;
		const durationMilliseconds = serviceDuration * 60 * 1000;
		const slotStepMilliseconds = schedule.slotDurationMinutes * 60 * 1000;

		for (let cursor = workStart; cursor + durationMilliseconds <= workEnd; cursor += slotStepMilliseconds) {
			const slotEnd = cursor + durationMilliseconds;
			const overlapsBreak = breakStart !== undefined && breakEnd !== undefined && cursor < breakEnd && slotEnd > breakStart;
			const overlapsAppointment = appointments.some(
				(appointment) => cursor < appointment.endsAt.getTime() && slotEnd > appointment.startsAt.getTime(),
			);
			if (
				cursor > Date.now() &&
				!overlapsBreak &&
				!overlapsAppointment &&
				serviceAllowsInterval(service, new Date(cursor), new Date(slotEnd))
			) {
				slots.push({ startsAt: new Date(cursor), endsAt: new Date(slotEnd) });
			}
		}

		return slots;
	}

	private async ensureActiveDoctor(doctorId: ObjectId): Promise<Doctor> {
		const doctor = await this.doctorModel
			.findOne({ _id: doctorId, memberStatus: MemberStatus.ACTIVE, deletedAt: { $exists: false } })
			.select('_id docRoom')
			.lean()
			.exec();
		if (!doctor) throw new InternalServerErrorException('Doctor was not found');
		return doctor;
	}

	private validateTimeRange(input: { startTime: string; endTime: string; breakStart?: string; breakEnd?: string }) {
		const startMinutes = this.timeToMinutes(input.startTime);
		const endMinutes = this.timeToMinutes(input.endTime);
		if (endMinutes <= startMinutes) throw new BadRequestException('Schedule end time must be after start time');

		const hasBreakStart = Boolean(input.breakStart);
		const hasBreakEnd = Boolean(input.breakEnd);
		if (hasBreakStart !== hasBreakEnd) throw new BadRequestException('Break start and break end must be provided together');

		const breakStartMinutes = input.breakStart ? this.timeToMinutes(input.breakStart) : undefined;
		const breakEndMinutes = input.breakEnd ? this.timeToMinutes(input.breakEnd) : undefined;
		if (
			breakStartMinutes !== undefined &&
			breakEndMinutes !== undefined &&
			(breakEndMinutes <= breakStartMinutes || breakStartMinutes < startMinutes || breakEndMinutes > endMinutes)
		) {
			throw new BadRequestException('Break must be inside the working interval');
		}

		return {
			startMinutes,
			endMinutes,
			workMinutes: endMinutes - startMinutes,
			breakStartMinutes,
			breakEndMinutes,
		};
	}

	private timeToMinutes(value: string): number {
		if (!/^\d{2}:\d{2}$/.test(value)) throw new BadRequestException('Time must use HH:mm format');
		const [hours, minutes] = value.split(':').map(Number);
		if (hours > 23 || minutes > 59) throw new BadRequestException('Time must use a valid 24-hour value');
		return hours * 60 + minutes;
	}
}

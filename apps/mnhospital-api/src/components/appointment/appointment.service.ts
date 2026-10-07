import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { v4 as uuidv4 } from 'uuid';
import { Appointment, Appointments } from './dto/appointment';
import {
	AppointmentInput as AppointmentCreateInput,
	AppointmentInquiry,
	StaffAppointmentInquiry,
} from './dto/appointment.input';
import { HospitalRoom } from './dto/room';
import { RoomStatus } from '../../libs/enums/appointment.enum';
import { AppointmentStatus } from '../../libs/enums/appointment.enum';
import { Message } from '../../libs/enums/common.enum';
import { MemberType } from '../member/enums/member.enum';
import { PatientService } from '../patient/patient.service';
import { BookingOrder } from '../booking/dto/booking-order';
import { BookingOrderStatus } from '../patient/enums/patient.enum';
import { ReceptionTask } from '../receptionist/dto/reception-task';
import { ReceptionTaskStatus } from '../receptionist/enums/receptionist.enum';
import { NotificationEventService } from '../notification/notification-event.service';
import { NotificationGroup, NotificationType } from '../notification/enums/notification.enum';

@Injectable()
export class AppointmentService {
	constructor(
		@InjectModel('Appointment') private readonly appointmentModel: Model<Appointment>,
		@InjectModel('BookingOrder') private readonly bookingOrderModel: Model<BookingOrder>,
		@InjectModel('ReceptionTask') private readonly receptionTaskModel: Model<ReceptionTask>,
		private readonly patientService: PatientService,
		private readonly notificationEvents: NotificationEventService,
		@InjectModel('Room') private readonly roomModel: Model<HospitalRoom>,
	) {}

	public async createAppointment(memberId: ObjectId, input: AppointmentCreateInput): Promise<Appointment> {
		const requestedStartsAt = new Date(input.startsAt);
		const requestedEndsAt = new Date(input.endsAt);
		if (Number.isNaN(requestedStartsAt.getTime()) || Number.isNaN(requestedEndsAt.getTime())) {
			throw new BadRequestException('Appointment time must be valid dates');
		}
		if (requestedEndsAt <= requestedStartsAt) {
			throw new BadRequestException('Appointment end time must be after start time');
		}
		const patientId = await this.patientService.resolveProfileId(memberId);
		const bookingOrder = await this.bookingOrderModel
			.findOne({ _id: input.bookingOrderId, patientId, bookingOrderStatus: BookingOrderStatus.CONFIRMED })
			.exec();
		if (!bookingOrder) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const orderItem = bookingOrder.bookingOrderItems.find(
			(item) => item.serviceId === input.serviceId.toString() && item.doctorId === input.doctorId.toString(),
		);
		if (!orderItem || orderItem.appointmentId) {
			throw new BadRequestException('The selected booking order item is not available for appointment creation');
		}
		const startsAt = new Date(orderItem.requestedStartAt);
		const serviceDuration = Number.parseInt(orderItem.serviceDuration, 10);
		if (Number.isNaN(startsAt.getTime()) || !Number.isFinite(serviceDuration) || serviceDuration <= 0) {
			throw new BadRequestException('The booking order contains an invalid appointment time');
		}
		const endsAt = new Date(startsAt.getTime() + serviceDuration * 60 * 1000);
		if (requestedStartsAt.getTime() !== startsAt.getTime() || requestedEndsAt.getTime() !== endsAt.getTime()) {
			throw new BadRequestException('Appointment time must match the booking order item');
		}

		const room = await this.roomModel.findOne({ _id: input.roomId, roomStatus: RoomStatus.AVAILABLE }).lean().exec();
		if (!room) throw new BadRequestException('The selected room is not available');

		const conflict = await this.appointmentModel
			.findOne({
				appointmentStatus: {
					$in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS],
				},
				startsAt: { $lt: endsAt },
				endsAt: { $gt: startsAt },
				$or: [{ doctorId: input.doctorId }, { patientId }, { roomId: input.roomId }],
			})
			.select('_id doctorId patientId roomId startsAt endsAt')
			.lean()
			.exec();
		if (conflict) {
			throw new BadRequestException('The doctor, patient, or room already has an appointment at this time');
		}

		const appointment = await this.appointmentModel.create({
			...input,
			appointmentCode: `APT-${uuidv4()}`,
			patientId,
			createdByMemberId: memberId,
			appointmentStatus: AppointmentStatus.PENDING,
			startsAt,
			endsAt,
		});

		const updatedOrder = await this.bookingOrderModel
			.findOneAndUpdate(
				{
					_id: bookingOrder._id,
					patientId,
					bookingOrderStatus: BookingOrderStatus.CONFIRMED,
					bookingOrderItems: {
						$elemMatch: {
							serviceId: input.serviceId.toString(),
							doctorId: input.doctorId.toString(),
							appointmentId: { $exists: false },
						},
					},
				},
				{ $set: { 'bookingOrderItems.$.appointmentId': appointment._id.toString() } },
				{ new: true },
			)
			.exec();

		if (!updatedOrder) {
			await this.appointmentModel.deleteOne({ _id: appointment._id }).exec();
			throw new BadRequestException('The booking order item was already used');
		}
		await this.notificationEvents.toPatient(patientId, {
			key: `appointment:${appointment._id}:created`,
			type: NotificationType.APPOINTMENT,
			group: NotificationGroup.APPOINTMENT,
			title: 'Appointment request received',
			description: 'Your appointment request is pending review.',
			refId: appointment._id,
			authorId: memberId,
			authorType: MemberType.PATIENT,
		});
		await this.notificationEvents.toDoctor(appointment.doctorId, {
			key: `appointment:${appointment._id}:created`,
			type: NotificationType.APPOINTMENT,
			group: NotificationGroup.APPOINTMENT,
			title: 'New appointment request',
			description: 'A new appointment request is ready for review.',
			refId: appointment._id,
			authorId: memberId,
			authorType: MemberType.PATIENT,
		});

		return appointment;
	}

	public async cancelAppointment(memberId: ObjectId, appointmentId: ObjectId, reason?: string): Promise<Appointment> {
		const patientId = await this.patientService.resolveProfileId(memberId);
		const appointment = await this.appointmentModel
			.findOne({
				_id: appointmentId,
				patientId,
				appointmentStatus: { $in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
			})
			.exec();

		if (!appointment) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		appointment.statusHistory.push({
			previousStatus: appointment.appointmentStatus,
			newStatus: AppointmentStatus.CANCELLED,
			changedByMemberId: memberId,
			reason,
			changedAt: new Date(),
		} as any);
		appointment.appointmentStatus = AppointmentStatus.CANCELLED;
		appointment.cancellationReason = reason;
		appointment.cancelledAt = new Date();

		const result = await appointment.save();
		await this.notificationEvents.toDoctor(result.doctorId, {
			key: `appointment:${result._id}:cancelled`,
			type: NotificationType.APPOINTMENT,
			group: NotificationGroup.APPOINTMENT,
			title: 'Appointment cancelled',
			description: 'An appointment on your schedule was cancelled.',
			refId: result._id,
			authorId: memberId,
			authorType: MemberType.PATIENT,
		});
		return result;
	}

	public async getMyAppointments(memberId: ObjectId, input: AppointmentInquiry): Promise<Appointments> {
		const { page, limit, status } = input;
		const patientId = await this.patientService.resolveProfileId(memberId);
		const match: Record<string, unknown> = { patientId };
		if (status) match.appointmentStatus = status;

		const result = await this.appointmentModel
			.aggregate([
				{ $match: match },
				{ $sort: { startsAt: 1 } },
				{
					$facet: {
						list: [{ $skip: (page - 1) * limit }, { $limit: limit }],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		return result[0] ?? { list: [], metaCounter: [] };
	}

	public async getStaffAppointments(
		memberId: ObjectId,
		memberType: MemberType,
		input: StaffAppointmentInquiry,
	): Promise<Appointments> {
		const { page, limit, status, doctorId, patientId } = input;
		const match: Record<string, unknown> = {};

		if (memberType === MemberType.DOCTOR) match.doctorId = memberId;
		else if (memberType === MemberType.RECEPTIONIST) {
			const tasks = await this.receptionTaskModel
				.find({
					receptionistId: memberId,
					taskStatus: { $nin: [ReceptionTaskStatus.CANCELLED, ReceptionTaskStatus.COMPLETED] },
				})
				.select('appointmentId')
				.lean()
				.exec();
			match._id = { $in: tasks.map((task) => task.appointmentId) };
			if (doctorId) match.doctorId = doctorId;
		} else if (doctorId) match.doctorId = doctorId;

		if (patientId) match.patientId = patientId;
		if (status) match.appointmentStatus = status;

		const result = await this.appointmentModel
			.aggregate([
				{ $match: match },
				{ $sort: { startsAt: 1 } },
				{
					$facet: {
						list: [{ $skip: (page - 1) * limit }, { $limit: limit }],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		return result[0] ?? { list: [], metaCounter: [] };
	}

	public async updateAppointmentStatus(
		memberId: ObjectId,
		memberType: MemberType,
		appointmentId: ObjectId,
		appointmentStatus: AppointmentStatus,
		reason?: string,
	): Promise<Appointment> {
		const appointment = await this.appointmentModel.findById(appointmentId).exec();
		if (!appointment) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		if (memberType === MemberType.DOCTOR && appointment.doctorId.toString() !== memberId.toString()) {
			throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		}
		if (memberType === MemberType.RECEPTIONIST) {
			const assignedTask = await this.receptionTaskModel
				.findOne({
					appointmentId,
					receptionistId: memberId,
					taskStatus: { $nin: [ReceptionTaskStatus.CANCELLED, ReceptionTaskStatus.COMPLETED] },
				})
				.select('_id')
				.lean()
				.exec();
			if (!assignedTask) throw new ForbiddenException('This appointment is not assigned to you');
			if (
				![AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS, AppointmentStatus.NO_SHOW].includes(
					appointmentStatus,
				)
			) {
				throw new ForbiddenException('Receptionist cannot apply this appointment status');
			}
		}

		const allowedStatuses: Record<AppointmentStatus, AppointmentStatus[]> = {
			[AppointmentStatus.PENDING]: [
				AppointmentStatus.CONFIRMED,
				AppointmentStatus.CANCELLED,
				AppointmentStatus.NO_SHOW,
			],
			[AppointmentStatus.CONFIRMED]: [
				AppointmentStatus.IN_PROGRESS,
				AppointmentStatus.CANCELLED,
				AppointmentStatus.NO_SHOW,
			],
			[AppointmentStatus.IN_PROGRESS]: [AppointmentStatus.ENDED, AppointmentStatus.COMPLETED],
			[AppointmentStatus.ENDED]: [AppointmentStatus.COMPLETED],
			[AppointmentStatus.COMPLETED]: [],
			[AppointmentStatus.CANCELLED]: [],
			[AppointmentStatus.NO_SHOW]: [],
		};

		if (!allowedStatuses[appointment.appointmentStatus].includes(appointmentStatus)) {
			throw new BadRequestException(
				`Cannot change appointment status from ${appointment.appointmentStatus} to ${appointmentStatus}`,
			);
		}

		appointment.statusHistory.push({
			previousStatus: appointment.appointmentStatus,
			newStatus: appointmentStatus,
			changedByMemberId: memberId,
			reason,
			changedAt: new Date(),
		} as any);
		appointment.appointmentStatus = appointmentStatus;
		if ([AppointmentStatus.ENDED, AppointmentStatus.COMPLETED].includes(appointmentStatus)) {
			appointment.completedAt = new Date();
		}

		const result = await appointment.save();
		const event = {
			key: `appointment:${result._id}:${appointmentStatus}`,
			type: NotificationType.APPOINTMENT,
			group: NotificationGroup.APPOINTMENT,
			title: 'Appointment status updated',
			description: `Your appointment status is now ${appointmentStatus.toLowerCase().replace(/_/g, ' ')}.`,
			refId: result._id,
			authorId: memberId,
			authorType: memberType,
		};
		await this.notificationEvents.toPatient(result.patientId, event);
		if (appointmentStatus === AppointmentStatus.CONFIRMED && memberType !== MemberType.DOCTOR) {
			await this.notificationEvents.toDoctor(result.doctorId, {
				...event,
				title: 'Appointment confirmed',
				description: 'An appointment on your schedule was confirmed.',
			});
		}
		return result;
	}
}

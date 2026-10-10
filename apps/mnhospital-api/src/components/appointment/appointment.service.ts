import { appointmentPatientPreview } from './patient-preview';
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
import { Payment } from '../booking/dto/payment';
import { Doctor } from '../doctor/dto/doctor';
import { DoctorScheduleService } from '../doctor/doctor-schedule/doctorSchedule.service';
import { appointmentSlotKeys, clinicDate } from '../../libs/booking/clinic-time';
import { PaymentProvider, PaymentStatus } from '../patient/enums/patient.enum';
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
		@InjectModel('Doctor') private readonly doctorModel?: Model<Doctor>,
		@InjectModel('Payment') private readonly paymentModel?: Model<Payment>,
		private readonly scheduleService?: DoctorScheduleService,
	) {}

	public async createAppointment(memberId: ObjectId, input: AppointmentCreateInput, reserveOnline = false): Promise<Appointment> {
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
			.findOne({ _id: input.bookingOrderId, patientId, bookingOrderStatus: { $in: [BookingOrderStatus.PENDING, BookingOrderStatus.CONFIRMED] } })
			.exec();
		if (!bookingOrder) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const orderItem = bookingOrder.bookingOrderItems.find(
			(item) => item.serviceId === input.serviceId.toString() && item.doctorId === input.doctorId.toString(),
		);
		if (!orderItem) {
			throw new BadRequestException('The selected booking order item is not available for appointment creation');
		}
		if (orderItem.appointmentId) {
			const existing = await this.appointmentModel.findOne({ _id: orderItem.appointmentId, patientId }).exec();
			if (existing && existing.appointmentStatus !== AppointmentStatus.CANCELLED) return existing;
			throw new BadRequestException('The previous reservation expired or was cancelled. Choose a new appointment.');
		}
		const startsAt = new Date(orderItem.requestedStartAt);
		const serviceDuration = Number(orderItem.serviceDuration);
		if (Number.isNaN(startsAt.getTime()) || !Number.isInteger(serviceDuration) || serviceDuration <= 0 || serviceDuration > 1440) {
			throw new BadRequestException('The booking order contains an invalid appointment time');
		}
		const endsAt = new Date(startsAt.getTime() + serviceDuration * 60 * 1000);
		if (requestedStartsAt.getTime() !== startsAt.getTime() || requestedEndsAt.getTime() !== endsAt.getTime()) {
			throw new BadRequestException('Appointment time must match the booking order item');
		}

		if (startsAt.getTime() <= Date.now()) throw new BadRequestException('Appointment must be in the future');

		const room = await this.roomModel.findOne({ _id: input.roomId, roomStatus: RoomStatus.AVAILABLE, $or: [{ assignedDoctorId: null }, { assignedDoctorId: input.doctorId }] }).lean().exec();
		if (!room) throw new BadRequestException('The selected room is not available');

		const payment = await this.paymentModel.findOne({
			bookingOrderId: bookingOrder._id, patientId, serviceId: input.serviceId, doctorId: input.doctorId,
			$or: [
				{ paymentStatus: PaymentStatus.PAID },
				{ paymentProvider: PaymentProvider.CASH, paymentStatus: PaymentStatus.PENDING },
				...(reserveOnline ? [{ paymentProvider: PaymentProvider.EXIMBAY, paymentStatus: PaymentStatus.PENDING }] : []),
			],
		}).lean().exec();
		if (!payment) throw new BadRequestException('Choose cash payment or complete online payment first');
		const available = await this.scheduleService.getAvailableSlots({ doctorId: input.doctorId, serviceId: input.serviceId, date: clinicDate(startsAt) });
		if (!available.some((slot) => slot.startsAt.getTime() === startsAt.getTime() && slot.endsAt.getTime() === endsAt.getTime())) {
			throw new BadRequestException('This appointment time is no longer available. Choose another time.');
		}

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

		let appointment: Appointment;
		try {
		appointment = await this.appointmentModel.create({
			...input,
			appointmentCode: `APT-${uuidv4()}`,
			patientId,
			createdByMemberId: memberId,
			appointmentStatus: AppointmentStatus.PENDING,
			startsAt,
			endsAt,
			slotKeys: appointmentSlotKeys(String(input.doctorId), String(patientId), String(input.roomId), startsAt, endsAt),
			...(payment.paymentProvider === PaymentProvider.EXIMBAY && payment.paymentStatus === PaymentStatus.PENDING
				? { holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000) } : {}),
		});
		} catch (error) {
			if (error?.code === 11000) throw new BadRequestException('This appointment time was just reserved. Choose another time.');
			throw error;
		}

		let updatedOrder: BookingOrder;
		try {
		updatedOrder = await this.bookingOrderModel
			.findOneAndUpdate(
				{
					_id: bookingOrder._id,
					patientId,
					bookingOrderStatus: { $in: [BookingOrderStatus.PENDING, BookingOrderStatus.CONFIRMED] },
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

		} catch (error) {
			await this.appointmentModel.deleteOne({ _id: appointment._id }).exec();
			throw error;
		}
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

	public async scheduleBookingLine(memberId: ObjectId, order: BookingOrder, serviceId: string, doctorId: string, reserveOnline = false): Promise<Appointment> {
		const item = order.bookingOrderItems.find((line) => line.serviceId === serviceId && line.doctorId === doctorId);
		if (!item) throw new BadRequestException('Booking line was not found');
		const patientId = await this.patientService.resolveProfileId(memberId);
		if (String(order.patientId) !== String(patientId)) throw new ForbiddenException('Booking order is not yours');
		if (item.appointmentId) {
			const existing = await this.appointmentModel.findOne({ _id: item.appointmentId, patientId }).exec();
			if (existing && existing.appointmentStatus !== AppointmentStatus.CANCELLED && (!existing.holdExpiresAt || existing.holdExpiresAt.getTime() > Date.now())) return existing;
			throw new BadRequestException('The reservation expired or was cancelled. Choose a new appointment.');
		}
		const doctor = await this.doctorModel.findById(doctorId).select('docRoom').lean().exec();
		if (!doctor?.docRoom) throw new BadRequestException('This doctor has no assigned room');
		const room = await this.roomModel.findOne({ roomNumber: doctor.docRoom, roomStatus: RoomStatus.AVAILABLE,
			$or: [{ assignedDoctorId: null }, { assignedDoctorId: new Types.ObjectId(doctorId) }] }).lean().exec();
		if (!room) throw new BadRequestException('The doctor room is unavailable');
		const startsAt = new Date(item.requestedStartAt);
		return this.createAppointment(memberId, {
			bookingOrderId: order._id, serviceId: new Types.ObjectId(serviceId), doctorId: new Types.ObjectId(doctorId),
			roomId: new Types.ObjectId(room._id), startsAt,
			endsAt: new Date(startsAt.getTime() + Number(item.serviceDuration) * 60000),
			appointmentType: 'CONSULTATION', appointmentReason: item.serviceName,
			appointmentDesc: item.patientNote?.trim() || item.serviceName,
		}, reserveOnline);
	}

	public async assertOrderCancellable(order: BookingOrder): Promise<void> {
		const started = await this.appointmentModel.findOne({ bookingOrderId: order._id, patientId: order.patientId,
			appointmentStatus: { $in: [AppointmentStatus.IN_PROGRESS, AppointmentStatus.ENDED, AppointmentStatus.COMPLETED] } }).select('_id').lean().exec();
		if (started) throw new BadRequestException('A booking with a started appointment cannot be cancelled');
	}

	public async completeBookingIfFinished(orderId: ObjectId): Promise<void> {
		const order = await this.bookingOrderModel.findOne({ _id: orderId, bookingOrderStatus: BookingOrderStatus.CONFIRMED }).exec();
		if (!order) return;
		const completed = await this.appointmentModel.find({ bookingOrderId: order._id, patientId: order.patientId,
			appointmentStatus: AppointmentStatus.COMPLETED }).select('_id').lean().exec();
		const ids = new Set(completed.map((appointment) => String(appointment._id)));
		if (order.bookingOrderItems.length && order.bookingOrderItems.every((line) => line.appointmentId && ids.has(line.appointmentId))) {
			await this.bookingOrderModel.updateOne({ _id: order._id, bookingOrderStatus: BookingOrderStatus.CONFIRMED },
				{ $set: { bookingOrderStatus: BookingOrderStatus.COMPLETED } }).exec();
		}
	}

	public async cancelOrderReservations(order: BookingOrder, memberId: ObjectId): Promise<void> {
		const reservations = await this.appointmentModel.find({ bookingOrderId: order._id, patientId: order.patientId,
			appointmentStatus: { $in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] } }).exec();
		for (const appointment of reservations) await this.cancelAppointment(memberId, appointment._id, 'Booking order cancelled');
	}

	public async cancelPaymentReservation(payment: Payment): Promise<void> {
		await this.appointmentModel.updateMany({ bookingOrderId: payment.bookingOrderId, serviceId: payment.serviceId,
			doctorId: payment.doctorId, patientId: payment.patientId, appointmentStatus: AppointmentStatus.PENDING, holdExpiresAt: { $exists: true } },
			{ $set: { appointmentStatus: AppointmentStatus.CANCELLED, slotKeys: [], cancelledAt: new Date(), cancellationReason: 'Test payment did not complete' } }).exec();
		await this.bookingOrderModel.updateOne({ _id: payment.bookingOrderId, patientId: payment.patientId },
			{ $unset: { 'bookingOrderItems.$[line].appointmentId': '' } },
			{ arrayFilters: [{ 'line.serviceId': String(payment.serviceId), 'line.doctorId': String(payment.doctorId) }] }).exec();
	}

	public async assertPaymentReservation(payment: Payment): Promise<void> {
		const reservation = await this.appointmentModel.findOne({ bookingOrderId: payment.bookingOrderId, serviceId: payment.serviceId,
			doctorId: payment.doctorId, patientId: payment.patientId, appointmentStatus: AppointmentStatus.PENDING, holdExpiresAt: { $gt: new Date() } }).select('_id').lean().exec();
		if (!reservation) throw new BadRequestException('The payment reservation expired. Choose a new appointment.');
	}

	public async settlePaymentReservation(payment: Payment): Promise<void> {
		await this.appointmentModel.updateMany({ bookingOrderId: payment.bookingOrderId, serviceId: payment.serviceId,
			doctorId: payment.doctorId, patientId: payment.patientId, appointmentStatus: AppointmentStatus.PENDING },
			{ $unset: { holdExpiresAt: 1 } }).exec();
		await this.completeBookingIfFinished(payment.bookingOrderId);
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
		appointment.slotKeys = [];

		const result = await appointment.save();
		await this.receptionTaskModel.updateMany({ appointmentId: result._id, taskStatus: { $nin: [ReceptionTaskStatus.CANCELLED, ReceptionTaskStatus.COMPLETED] } },
			{ $inc: { __v: 1 }, $set: { taskStatus: ReceptionTaskStatus.CANCELLED }, $push: { statusHistory: { newStatus: ReceptionTaskStatus.CANCELLED, changedByMemberId: memberId, changedAt: new Date(), reason: 'Appointment cancelled' } } }).exec();
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
						list: [{ $skip: (page - 1) * limit }, { $limit: limit }, ...appointmentPatientPreview()],
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

		if ([AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS].includes(appointmentStatus)) {
			const eligible = await this.paymentModel.findOne({ bookingOrderId: appointment.bookingOrderId, serviceId: appointment.serviceId, doctorId: appointment.doctorId, patientId: appointment.patientId,
				$or: [{ paymentStatus: PaymentStatus.PAID }, { paymentProvider: PaymentProvider.CASH, paymentStatus: PaymentStatus.PENDING }] }).lean().exec();
			if (!eligible) throw new BadRequestException('Online payment must be confirmed before accepting this appointment');
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

		if ([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW, AppointmentStatus.ENDED, AppointmentStatus.COMPLETED].includes(appointmentStatus)) appointment.slotKeys = [];
		const result = await appointment.save();
        if ([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW].includes(appointmentStatus)) {
            await this.receptionTaskModel.updateMany({ appointmentId: result._id, taskStatus: { $nin: [ReceptionTaskStatus.CANCELLED, ReceptionTaskStatus.COMPLETED] } },
                { $inc: { __v: 1 }, $set: { taskStatus: ReceptionTaskStatus.CANCELLED }, $push: { statusHistory: { newStatus: ReceptionTaskStatus.CANCELLED, changedByMemberId: memberId, changedAt: new Date(), reason: `Appointment ${appointmentStatus.toLowerCase()}` } } }).exec();
        }
		if (appointmentStatus === AppointmentStatus.COMPLETED) await this.completeBookingIfFinished(result.bookingOrderId);
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

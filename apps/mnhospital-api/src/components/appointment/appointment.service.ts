import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { v4 as uuidv4 } from 'uuid';
import { Appointment, Appointments } from './dto/appointment';
import { AppointmentInput as AppointmentCreateInput, AppointmentInquiry, StaffAppointmentInquiry } from './dto/appointment.input';
import { AppointmentStatus } from '../../libs/enums/appointment.enum';
import { Message } from '../../libs/enums/common.enum';
import { MemberType } from '../member/enums/member.enum';
import { PatientService } from '../patient/patient.service';
import { BookingOrder } from '../booking/dto/booking-order';
import { BookingOrderStatus } from '../patient/enums/patient.enum';

@Injectable()
export class AppointmentService {
	constructor(
		@InjectModel('Appointment') private readonly appointmentModel: Model<Appointment>,
		@InjectModel('BookingOrder') private readonly bookingOrderModel: Model<BookingOrder>,
		private readonly patientService: PatientService,
	) {}

	public async createAppointment(memberId: ObjectId, input: AppointmentCreateInput): Promise<Appointment> {
		if (input.endsAt <= input.startsAt) {
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
					'bookingOrderItems.serviceId': input.serviceId.toString(),
					'bookingOrderItems.doctorId': input.doctorId.toString(),
					'bookingOrderItems.appointmentId': { $exists: false },
				},
				{ $set: { 'bookingOrderItems.$.appointmentId': appointment._id.toString() } },
				{ new: true },
			)
			.exec();

		if (!updatedOrder) {
			await this.appointmentModel.deleteOne({ _id: appointment._id }).exec();
			throw new BadRequestException('The booking order item was already used');
		}

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

		return await appointment.save();
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

	public async getStaffAppointments(memberId: ObjectId, memberType: MemberType, input: StaffAppointmentInquiry): Promise<Appointments> {
		const { page, limit, status, doctorId, patientId } = input;
		const match: Record<string, unknown> = {};

		if (memberType === MemberType.DOCTOR) match.doctorId = memberId;
		else if (doctorId) match.doctorId = doctorId;

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

		const allowedStatuses: Record<AppointmentStatus, AppointmentStatus[]> = {
			[AppointmentStatus.PENDING]: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
			[AppointmentStatus.CONFIRMED]: [AppointmentStatus.IN_PROGRESS, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
			[AppointmentStatus.IN_PROGRESS]: [AppointmentStatus.ENDED, AppointmentStatus.COMPLETED],
			[AppointmentStatus.ENDED]: [AppointmentStatus.COMPLETED],
			[AppointmentStatus.COMPLETED]: [],
			[AppointmentStatus.CANCELLED]: [],
			[AppointmentStatus.NO_SHOW]: [],
		};

		if (!allowedStatuses[appointment.appointmentStatus].includes(appointmentStatus)) {
			throw new BadRequestException(`Cannot change appointment status from ${appointment.appointmentStatus} to ${appointmentStatus}`);
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

		return await appointment.save();
	}
}

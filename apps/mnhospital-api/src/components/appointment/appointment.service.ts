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

@Injectable()
export class AppointmentService {
	constructor(@InjectModel('Appointment') private readonly appointmentModel: Model<Appointment>) {}

	public async createAppointment(memberId: ObjectId, input: AppointmentCreateInput): Promise<Appointment> {
		if (input.endsAt <= input.startsAt) {
			throw new BadRequestException('Appointment end time must be after start time');
		}

		return await this.appointmentModel.create({
			...input,
			appointmentCode: `APT-${uuidv4()}`,
			patientId: memberId,
			createdByMemberId: memberId,
			appointmentStatus: AppointmentStatus.PENDING,
		});
	}

	public async cancelAppointment(memberId: ObjectId, appointmentId: ObjectId, reason?: string): Promise<Appointment> {
		const appointment = await this.appointmentModel
			.findOne({
				_id: appointmentId,
				patientId: memberId,
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
		const match: Record<string, unknown> = { patientId: memberId };
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

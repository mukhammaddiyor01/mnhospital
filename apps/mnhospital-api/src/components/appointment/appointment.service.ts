import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { v4 as uuidv4 } from 'uuid';
import { Appointment } from './dto/appointment';
import { AppointmentInput as AppointmentCreateInput } from './dto/appointment.input';
import { AppointmentStatus } from '../../libs/enums/appointment.enum';
import { Message } from '../../libs/enums/common.enum';

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
}

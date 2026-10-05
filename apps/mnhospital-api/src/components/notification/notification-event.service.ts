import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MemberType } from '../member/enums/member.enum';
import { Patient } from '../patient/dto/patient';
import { NotificationGroup, NotificationType } from './enums/notification.enum';
import { NotificationService } from './notification.service';

export interface NotificationEvent {
	key: string;
	type: NotificationType;
	group: NotificationGroup;
	title: string;
	description: string;
	refId: Types.ObjectId;
	authorId?: Types.ObjectId;
	authorType?: MemberType;
}

@Injectable()
export class NotificationEventService {
	private readonly logger = new Logger(NotificationEventService.name);

	constructor(
		@InjectModel('Patient') private readonly patientModel: Model<Patient>,
		private readonly notificationService: NotificationService,
	) {}

	public async toPatient(patientProfileId: Types.ObjectId, event: NotificationEvent): Promise<void> {
		try {
			const patient = await this.patientModel.findById(patientProfileId).select('memberId').lean().exec();
			if (!patient?.memberId) {
				this.logger.warn(`Notification skipped: patient profile ${patientProfileId} has no member account`);
				return;
			}
			await this.publish(patient.memberId, MemberType.PATIENT, event);
		} catch (error) {
			this.logger.error(`Patient notification ${event.key} failed`, error instanceof Error ? error.stack : String(error));
		}
	}

	public async toDoctor(doctorId: Types.ObjectId, event: NotificationEvent): Promise<void> {
		await this.publishSafely(doctorId, MemberType.DOCTOR, event);
	}

	public async toReceptionist(receptionistId: Types.ObjectId, event: NotificationEvent): Promise<void> {
		await this.publishSafely(receptionistId, MemberType.RECEPTIONIST, event);
	}

	private async publishSafely(receiverId: Types.ObjectId, receiverType: MemberType, event: NotificationEvent): Promise<void> {
		try {
			await this.publish(receiverId, receiverType, event);
		} catch (error) {
			this.logger.error(`Notification ${event.key} failed`, error instanceof Error ? error.stack : String(error));
		}
	}

	private async publish(receiverId: Types.ObjectId, receiverType: MemberType, event: NotificationEvent): Promise<void> {
		await this.notificationService.createEventNotification(`${event.key}:${receiverType}:${receiverId}`, {
			notificationType: event.type,
			notificationGroup: event.group,
			notificationTitle: event.title,
			notificationDesc: event.description,
			notificationRefId: event.refId,
			authorId: event.authorId,
			authorType: event.authorType,
			receiverId,
			receiverType,
		});
	}
}

import { Field, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { AppointmentStatus } from '../../../libs/enums/appointment.enum';
import { TotalCounter } from '../../member/dto/member';

@ObjectType()
export class AppointmentPatientPreview {
	@Field(() => String, { nullable: true })
	patientFullName?: string;
	@Field(() => String, { nullable: true })
	patientImage?: string;
}

@ObjectType()
export class AppointmentStatusHistory {
	@Field(() => String, { nullable: true })
	previousStatus?: string;

	@Field(() => String)
	newStatus: string;

	@Field(() => String, { nullable: true })
	changedByMemberId?: ObjectId;

	@Field(() => String, { nullable: true })
	reason?: string;

	@Field(() => Date)
	changedAt: Date;
}

@ObjectType()
export class Appointment {
	receptionTaskId?: ObjectId;
	@Field(() => String, { nullable: true }) reportId?: string;
	@Field(() => Boolean, { nullable: true }) receptionAssigned?: boolean;
	@Field(() => AppointmentPatientPreview, { nullable: true })
	patientPreview?: AppointmentPatientPreview;
	slotKeys?: string[];
	@Field(() => Date, { nullable: true })
	holdExpiresAt?: Date;
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	appointmentCode: string;

	@Field(() => String)
	appointmentType: string;

	@Field(() => String)
	patientId: ObjectId;

	@Field(() => String)
	doctorId: ObjectId;

	@Field(() => String)
	serviceId: ObjectId;

	@Field(() => String)
	roomId: ObjectId;

	@Field(() => String)
	bookingOrderId: ObjectId;

	@Field(() => String)
	createdByMemberId: ObjectId;

	@Field(() => AppointmentStatus)
	appointmentStatus: AppointmentStatus;

	@Field(() => String)
	appointmentReason: string;

	@Field(() => String)
	appointmentDesc: string;

	@Field(() => [AppointmentStatusHistory])
	statusHistory: AppointmentStatusHistory[];

	@Field(() => Date)
	startsAt: Date;

	@Field(() => Date)
	endsAt: Date;

	@Field(() => String, { nullable: true })
	cancellationReason?: string;

	@Field(() => Date, { nullable: true })
	cancelledAt?: Date;

	@Field(() => Date, { nullable: true })
	completedAt?: Date;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}

@ObjectType()
export class Appointments {
	@Field(() => [Appointment])
	list: Appointment[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter: TotalCounter[];
}

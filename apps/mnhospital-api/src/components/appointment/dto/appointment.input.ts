import { Field, InputType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsInstance, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { AppointmentStatus } from '../../../libs/enums/appointment.enum';

const toObjectId = ({ value }: { value: unknown }) =>
	typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value;

@InputType()
export class AppointmentInput {
	@IsString()
	@IsNotEmpty()
	@Field(() => String)
	appointmentType: string;

	@Transform(toObjectId)
	@IsInstance(ObjectId)
	@IsNotEmpty()
	@Field(() => String)
	doctorId: ObjectId;

	@Transform(toObjectId)
	@IsInstance(ObjectId)
	@IsNotEmpty()
	@Field(() => String)
	serviceId: ObjectId;

	@Transform(toObjectId)
	@IsInstance(ObjectId)
	@IsNotEmpty()
	@Field(() => String)
	roomId: ObjectId;

	@Transform(toObjectId)
	@IsInstance(ObjectId)
	@IsNotEmpty()
	@Field(() => String)
	bookingOrderId: ObjectId;

	@IsString()
	@IsNotEmpty()
	@Field(() => String)
	appointmentReason: string;

	@IsString()
	@IsNotEmpty()
	@Field(() => String)
	appointmentDesc: string;

	@Type(() => Date)
	@IsDate()
	@Field(() => Date)
	startsAt: Date;

	@Type(() => Date)
	@IsDate()
	@Field(() => Date)
	endsAt: Date;
}

@InputType()
export class AppointmentInquiry {
	@IsNotEmpty()
	@Field(() => Number, { defaultValue: 1 })
	page: number = 1;

	@IsNotEmpty()
	@Field(() => Number, { defaultValue: 10 })
	limit: number = 10;

	@Field(() => AppointmentStatus, { nullable: true })
	status?: AppointmentStatus;
}

@InputType()
export class StaffAppointmentInquiry extends AppointmentInquiry {
	@Transform(toObjectId)
	@IsInstance(ObjectId)
	@IsOptional()
	@Field(() => String, { nullable: true })
	doctorId?: ObjectId;

	@Transform(toObjectId)
	@IsInstance(ObjectId)
	@IsOptional()
	@Field(() => String, { nullable: true })
	patientId?: ObjectId;
}

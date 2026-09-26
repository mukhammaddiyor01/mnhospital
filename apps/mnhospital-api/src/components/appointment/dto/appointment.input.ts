import { Field, InputType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsInstance, IsNotEmpty, IsString } from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;

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

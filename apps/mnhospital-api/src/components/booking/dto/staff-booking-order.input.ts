import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEnum, IsInstance, IsInt, IsOptional, Min } from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { BookingOrderStatus } from '../../patient/enums/patient.enum';

const toObjectId = ({ value }: { value: unknown }) =>
	typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value;

@InputType()
export class StaffBookingOrderInquiry {
	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 1 })
	page: number = 1;

	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 10 })
	limit: number = 10;

	@IsOptional()
	@IsEnum(BookingOrderStatus)
	@Field(() => BookingOrderStatus, { nullable: true })
	status?: BookingOrderStatus;

	@Transform(toObjectId)
	@IsInstance(ObjectId)
	@IsOptional()
	@Field(() => String, { nullable: true })
	patientId?: ObjectId;
}

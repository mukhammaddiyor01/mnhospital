import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInstance, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Weekday } from '../enums/doctor-schedule.enum';

const toObjectId = ({ value }: { value: unknown }) =>
	typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value;

@InputType()
export class DoctorScheduleInput {
	@IsEnum(Weekday)
	@Field(() => Weekday)
	weekday: Weekday;

	@IsString()
	@Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
	@Field(() => String)
	startTime: string;

	@IsString()
	@Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
	@Field(() => String)
	endTime: string;

	@IsString()
	@IsOptional()
	@Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
	@Field(() => String, { nullable: true })
	breakStart?: string;

	@IsString()
	@IsOptional()
	@Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
	@Field(() => String, { nullable: true })
	breakEnd?: string;

	@IsInt()
	@Min(1)
	@Max(1440)
	@Field(() => Int)
	slotDurationMinutes: number;

	@IsBoolean()
	@IsOptional()
	@Field(() => Boolean, { nullable: true, defaultValue: true })
	isActive?: boolean;
}

@InputType()
export class DoctorBookingAvailabilityInput {
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

}

@InputType()
export class AvailableDoctorSlotsInput extends DoctorBookingAvailabilityInput {
	@IsString()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	@Field(() => String)
	date: string;
}

@InputType()
export class AvailableDoctorDatesInput extends DoctorBookingAvailabilityInput {
	@IsString()
	@Matches(/^\d{4}-(?:0[1-9]|1[0-2])$/)
	@Field(() => String)
	month: string;
}

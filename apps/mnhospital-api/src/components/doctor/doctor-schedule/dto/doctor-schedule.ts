import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Weekday } from '../enums/doctor-schedule.enum';

@ObjectType()
export class DoctorSchedule {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	doctorId: ObjectId;

	@Field(() => Weekday)
	weekday: Weekday;

	@Field(() => String)
	startTime: string;

	@Field(() => String)
	endTime: string;

	@Field(() => String, { nullable: true })
	breakStart?: string;

	@Field(() => String, { nullable: true })
	breakEnd?: string;

	@Field(() => Int)
	slotDurationMinutes: number;

	@Field(() => Boolean)
	isActive: boolean;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}

@ObjectType()
export class AvailableDoctorSlot {
	@Field(() => Date)
	startsAt: Date;

	@Field(() => Date)
	endsAt: Date;
}

@ObjectType()
export class AvailableDoctorDates {
	@Field(() => [String])
	dates: string[];

	@Field(() => String)
	reason: string;
}

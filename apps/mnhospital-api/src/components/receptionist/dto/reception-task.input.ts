import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsInstance, IsInt, IsNotEmpty, IsOptional, IsString, Length, Min } from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { ReceptionTaskPriority, ReceptionTaskStatus, ReceptionTaskType } from '../enums/receptionist.enum';

const toObjectId = ({ value }: { value: unknown }) =>
	typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value;

@InputType()
export class ReceptionTaskInput {
	@Transform(toObjectId)
	@IsInstance(ObjectId)
	@IsNotEmpty()
	@Field(() => String)
	appointmentId: ObjectId;

	@Transform(toObjectId)
	@IsInstance(ObjectId)
	@IsOptional()
	@Field(() => String, { nullable: true })
	receptionistId?: ObjectId;

	@IsEnum(ReceptionTaskType)
	@IsNotEmpty()
	@Field(() => ReceptionTaskType)
	taskType: ReceptionTaskType;

	@IsEnum(ReceptionTaskPriority)
	@IsNotEmpty()
	@Field(() => ReceptionTaskPriority)
	taskPriority: ReceptionTaskPriority;

	@IsString()
	@IsNotEmpty()
	@Length(1, 2000)
	@Field(() => String)
	taskInstruction: string;

	@Type(() => Date)
	@IsDate()
	@IsOptional()
	@Field(() => Date, { nullable: true })
	dueAt?: Date;
}

@InputType()
export class ReceptionTaskStatusInput {
	@Transform(toObjectId)
	@IsInstance(ObjectId)
	@IsNotEmpty()
	@Field(() => String)
	taskId: ObjectId;

	@IsEnum(ReceptionTaskStatus)
	@IsNotEmpty()
	@Field(() => ReceptionTaskStatus)
	taskStatus: ReceptionTaskStatus;

	@IsString()
	@IsOptional()
	@Length(0, 2000)
	@Field(() => String, { nullable: true })
	taskResult?: string;

	@IsString()
	@IsOptional()
	@Length(0, 1000)
	@Field(() => String, { nullable: true })
	reason?: string;
}

@InputType()
export class ReceptionTaskInquiry {
	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 1 })
	page = 1;

	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 10 })
	limit = 10;

	@IsEnum(ReceptionTaskStatus)
	@IsOptional()
	@Field(() => ReceptionTaskStatus, { nullable: true })
	taskStatus?: ReceptionTaskStatus;
}

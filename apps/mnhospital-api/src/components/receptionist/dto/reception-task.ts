import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { ReceptionTaskPriority, ReceptionTaskStatus, ReceptionTaskType } from '../enums/receptionist.enum';
import { TotalCounter } from '../../member/dto/member';

@ObjectType()
export class ReceptionTaskStatusHistory {
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
export class ReceptionTask {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String, { nullable: true })
	appointmentId?: ObjectId;

	@Field(() => String)
	patientId: ObjectId;

	@Field(() => String)
	doctorId: ObjectId;

	@Field(() => String, { nullable: true })
	receptionistId?: ObjectId;

	@Field(() => String)
	createdByMemberId: ObjectId;

	@Field(() => ReceptionTaskType)
	taskType: ReceptionTaskType;

	@Field(() => ReceptionTaskPriority)
	taskPriority: ReceptionTaskPriority;

	@Field(() => ReceptionTaskStatus)
	taskStatus: ReceptionTaskStatus;

	@Field(() => String)
	taskInstruction: string;

	@Field(() => String, { nullable: true })
	taskResult?: string;

	@Field(() => [ReceptionTaskStatusHistory])
	statusHistory: ReceptionTaskStatusHistory[];

	@Field(() => Date, { nullable: true })
	dueAt?: Date;

	@Field(() => Date, { nullable: true })
	acceptedAt?: Date;

	@Field(() => Date, { nullable: true })
	completedAt?: Date;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}

@ObjectType()
export class ReceptionTasks {
	@Field(() => [ReceptionTask])
	list: ReceptionTask[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter?: TotalCounter[];
}

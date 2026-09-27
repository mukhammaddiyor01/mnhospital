import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { MemberStatus } from '../../member/enums/member.enum';

@ObjectType()
export class ReceptionistDashboardStats {
	@Field(() => String)
	receptionistId: ObjectId;

	@Field(() => MemberStatus)
	memberStatus: MemberStatus;

	@Field(() => Int)
	taskCount: number;

	@Field(() => Int)
	pendingTaskCount: number;

	@Field(() => Int)
	acceptedTaskCount: number;

	@Field(() => Int)
	inProgressTaskCount: number;

	@Field(() => Int)
	completedTaskCount: number;

	@Field(() => Int)
	cancelledTaskCount: number;
}

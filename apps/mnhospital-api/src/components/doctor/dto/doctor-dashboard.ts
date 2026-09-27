import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { MemberStatus } from '../../member/enums/member.enum';

@ObjectType()
export class DoctorDashboardStats {
	@Field(() => String)
	doctorId: ObjectId;

	@Field(() => MemberStatus)
	memberStatus: MemberStatus;

	@Field(() => Int)
	serviceCount: number;

	@Field(() => Int)
	patientCount: number;

	@Field(() => Int)
	appointmentCount: number;

	@Field(() => Int)
	completedAppointmentCount: number;

	@Field(() => Int)
	reportCount: number;
}

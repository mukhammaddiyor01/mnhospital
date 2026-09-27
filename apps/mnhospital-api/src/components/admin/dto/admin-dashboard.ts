import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AdminDashboardStats {
	@Field(() => Int)
	totalPatients: number;

	@Field(() => Int)
	activePatients: number;

	@Field(() => Int)
	totalDoctors: number;

	@Field(() => Int)
	activeDoctors: number;

	@Field(() => Int)
	totalReceptionists: number;

	@Field(() => Int)
	activeReceptionists: number;

	@Field(() => Int)
	totalBookings: number;

	@Field(() => Int)
	totalAppointments: number;
}

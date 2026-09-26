import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { MemberType } from '../member/enums/member.enum';
import { Appointment, Appointments } from './dto/appointment';
import { AppointmentInput, AppointmentInquiry } from './dto/appointment.input';
import { AppointmentService } from './appointment.service';

@Resolver()
export class AppointmentResolver {
	constructor(private readonly appointmentService: AppointmentService) {}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Mutation(() => Appointment)
	public async createAppointment(
		@Args('input') input: AppointmentInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Appointment> {
		console.log('Mutation: createAppointment');
		return await this.appointmentService.createAppointment(memberId, input);
	}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Mutation(() => Appointment)
	public async cancelAppointment(
		@Args('appointmentId') input: string,
		@Args('reason', { type: () => String, nullable: true }) reason: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Appointment> {
		console.log('Mutation: cancelAppointment');
		return await this.appointmentService.cancelAppointment(memberId, shapeIntoMongoObjectId(input), reason);
	}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Query(() => Appointments)
	public async getMyAppointments(
		@Args('input') input: AppointmentInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Appointments> {
		console.log('Query: getMyAppointments');
		return await this.appointmentService.getMyAppointments(memberId, input);
	}
}

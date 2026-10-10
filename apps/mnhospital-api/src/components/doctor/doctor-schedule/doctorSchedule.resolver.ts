import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { shapeIntoMongoObjectId } from '../../../libs/config';
import { AuthMember } from '../../auth/decorators/authMember.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { WithoutGuard } from '../../auth/guards/without.guard';
import { MemberType } from '../../member/enums/member.enum';
import { AvailableDoctorDates, AvailableDoctorSlot, DoctorSchedule } from './dto/doctor-schedule';
import { AvailableDoctorDatesInput, AvailableDoctorSlotsInput, DoctorScheduleInput } from './dto/doctor-schedule.input';
import { DoctorScheduleService } from './doctorSchedule.service';

@Resolver()
export class DoctorScheduleResolver {
	constructor(private readonly doctorScheduleService: DoctorScheduleService) {}

	@Roles(MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Mutation(() => DoctorSchedule)
	public async upsertMyDoctorSchedule(
		@Args('input') input: DoctorScheduleInput,
		@AuthMember('_id') doctorId: ObjectId,
	): Promise<DoctorSchedule> {
		console.log('Mutation: upsertMyDoctorSchedule');
		return await this.doctorScheduleService.upsertMySchedule(doctorId, input);
	}

	@UseGuards(WithoutGuard)
	@Query(() => [DoctorSchedule])
	public async getDoctorSchedules(@Args('doctorId') doctorId: string): Promise<DoctorSchedule[]> {
		console.log('Query: getDoctorSchedules');
		return await this.doctorScheduleService.getDoctorSchedules(shapeIntoMongoObjectId(doctorId));
	}

	@UseGuards(WithoutGuard)
	@Query(() => [AvailableDoctorSlot])
	public async getAvailableDoctorSlots(@Args('input') input: AvailableDoctorSlotsInput): Promise<AvailableDoctorSlot[]> {
		console.log('Query: getAvailableDoctorSlots');
		return await this.doctorScheduleService.getAvailableSlots(input);
	}
	@UseGuards(WithoutGuard)
	@Query(() => AvailableDoctorDates)
	public async getAvailableDoctorDates(@Args('input') input: AvailableDoctorDatesInput): Promise<AvailableDoctorDates> {
		return this.doctorScheduleService.getAvailableDates(input);
	}

}

import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { shapeIntoMongoObjectId } from '../../libs/config';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType } from '../member/enums/member.enum';
import { ReceptionTask, ReceptionTasks } from './dto/reception-task';
import { ReceptionTaskInput, ReceptionTaskInquiry, ReceptionTaskStatusInput } from './dto/reception-task.input';
import { ReceptionistService } from './receptionist.service';
import { Receptionist, Receptionists } from './dto/receptionist';
import {
	ReceptionistAdminUpdateInput,
	ReceptionistInput,
	ReceptionistInquiry,
	ReceptionistLoginInput,
	ReceptionistProfileUpdateInput,
	ReceptionistStatusUpdateInput,
} from './dto/receptionist.input';
import { ReceptionistDashboardStats } from './dto/receptionist-dashboard';

@Resolver()
export class ReceptionistResolver {
	constructor(private readonly receptionistService: ReceptionistService) {}

	@Mutation(() => Receptionist)
	public async loginReceptionist(@Args('input') input: ReceptionistLoginInput): Promise<Receptionist> {
		console.log('Mutation: loginReceptionist');
		return await this.receptionistService.loginReceptionist(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Receptionist)
	public async createReceptionist(@Args('input') input: ReceptionistInput): Promise<Receptionist> {
		console.log('Mutation: createReceptionist');
		return await this.receptionistService.createReceptionist(input);
	}

	@Roles(MemberType.RECEPTIONIST)
	@UseGuards(RolesGuard)
	@Query(() => Receptionist)
	public async getMyReceptionistProfile(@AuthMember('_id') receptionistId: ObjectId): Promise<Receptionist> {
		console.log('Query: getMyReceptionistProfile');
		return await this.receptionistService.getMyProfile(receptionistId);
	}

	@Roles(MemberType.RECEPTIONIST)
	@UseGuards(RolesGuard)
	@Mutation(() => Receptionist)
	public async updateMyReceptionistProfile(
		@Args('input') input: ReceptionistProfileUpdateInput,
		@AuthMember('_id') receptionistId: ObjectId,
	): Promise<Receptionist> {
		console.log('Mutation: updateMyReceptionistProfile');
		return await this.receptionistService.updateMyProfile(receptionistId, input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => Receptionists)
	public async getReceptionists(@Args('input') input: ReceptionistInquiry): Promise<Receptionists> {
		console.log('Query: getReceptionists');
		return await this.receptionistService.getReceptionists(input);
	}

	@Roles(MemberType.RECEPTIONIST)
	@UseGuards(RolesGuard)
	@Query(() => ReceptionistDashboardStats)
	public async getMyReceptionistDashboardStats(
		@AuthMember('_id') receptionistId: ObjectId,
	): Promise<ReceptionistDashboardStats> {
		console.log('Query: getMyReceptionistDashboardStats');
		return this.receptionistService.getDashboardStats(receptionistId);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => ReceptionistDashboardStats)
	public async getReceptionistDashboardStatsByAdmin(
		@Args('receptionistId') receptionistId: string,
	): Promise<ReceptionistDashboardStats> {
		console.log('Query: getReceptionistDashboardStatsByAdmin');
		return this.receptionistService.getDashboardStats(shapeIntoMongoObjectId(receptionistId));
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Receptionist)
	public async updateReceptionistByAdmin(@Args('input') input: ReceptionistAdminUpdateInput): Promise<Receptionist> {
		console.log('Mutation: updateReceptionistByAdmin');
		return await this.receptionistService.updateByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Receptionist)
	public async updateReceptionistStatusByAdmin(
		@Args('input') input: ReceptionistStatusUpdateInput,
	): Promise<Receptionist> {
		console.log('Mutation: updateReceptionistStatusByAdmin');
		return await this.receptionistService.updateStatusByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Receptionist)
	public async removeReceptionistByAdmin(@Args('receptionistId') receptionistId: string): Promise<Receptionist> {
		console.log('Mutation: removeReceptionistByAdmin');
		return await this.receptionistService.removeByAdmin(shapeIntoMongoObjectId(receptionistId));
	}

	@Roles(MemberType.RECEPTIONIST, MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => ReceptionTask)
	public async createReceptionTask(
		@Args('input') input: ReceptionTaskInput,
		@AuthMember() authMember: { _id: ObjectId; memberType: MemberType },
	): Promise<ReceptionTask> {
		console.log('Mutation: createReceptionTask');
		return await this.receptionistService.createTask(authMember._id, authMember.memberType, input);
	}

	@Roles(MemberType.RECEPTIONIST, MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => ReceptionTasks)
	public async getReceptionTasks(
		@Args('input') input: ReceptionTaskInquiry,
		@AuthMember() authMember: { _id: ObjectId; memberType: MemberType },
	): Promise<ReceptionTasks> {
		console.log('Query: getReceptionTasks');
		return await this.receptionistService.getTasks(authMember._id, authMember.memberType, input);
	}

	@Roles(MemberType.RECEPTIONIST, MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => ReceptionTask)
	public async getReceptionTask(
		@Args('taskId') taskId: string,
		@AuthMember() authMember: { _id: ObjectId; memberType: MemberType },
	): Promise<ReceptionTask> {
		console.log('Query: getReceptionTask');
		return await this.receptionistService.getTask(authMember._id, authMember.memberType, shapeIntoMongoObjectId(taskId));
	}

	@Roles(MemberType.RECEPTIONIST, MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => ReceptionTask)
	public async updateReceptionTaskStatus(
		@Args('input') input: ReceptionTaskStatusInput,
		@AuthMember() authMember: { _id: ObjectId; memberType: MemberType },
	): Promise<ReceptionTask> {
		console.log('Mutation: updateReceptionTaskStatus');
		return await this.receptionistService.updateTask(authMember._id, authMember.memberType, input);
	}
}

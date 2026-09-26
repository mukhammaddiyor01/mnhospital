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

@Resolver()
export class ReceptionistResolver {
	constructor(private readonly receptionistService: ReceptionistService) {}

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

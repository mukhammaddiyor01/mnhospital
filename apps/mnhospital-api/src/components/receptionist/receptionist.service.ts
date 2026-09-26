import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Appointment } from '../appointment/dto/appointment';
import { AppointmentStatus } from '../../libs/enums/appointment.enum';
import { MemberStatus, MemberType } from '../member/enums/member.enum';
import { AuthService } from '../auth/auth.service';
import { Receptionist, Receptionists } from './dto/receptionist';
import {
	ReceptionistAdminUpdateInput,
	ReceptionistInput,
	ReceptionistInquiry,
	ReceptionistLoginInput,
	ReceptionistProfileUpdateInput,
} from './dto/receptionist.input';
import { ReceptionTask, ReceptionTasks } from './dto/reception-task';
import { ReceptionTaskInput, ReceptionTaskInquiry, ReceptionTaskStatusInput } from './dto/reception-task.input';
import { ReceptionTaskStatus } from './enums/receptionist.enum';

@Injectable()
export class ReceptionistService {
	constructor(
		@InjectModel('ReceptionTask') private readonly receptionTaskModel: Model<ReceptionTask>,
		@InjectModel('Appointment') private readonly appointmentModel: Model<Appointment>,
		@InjectModel('Receptionist') private readonly receptionistModel: Model<Receptionist>,
		private readonly authService: AuthService,
	) {}

	public async createReceptionist(input: ReceptionistInput): Promise<Receptionist> {
		const password = await this.authService.hashPassword(input.receptionistPassword);
		try {
			return await this.receptionistModel.create({
				...input,
				receptionistPassword: password,
				memberType: MemberType.RECEPTIONIST,
				memberStatus: MemberStatus.ACTIVE,
			});
		} catch (error) {
			throw new BadRequestException('Receptionist nick, phone, or mail is already used');
		}
	}

	public async loginReceptionist(input: ReceptionistLoginInput): Promise<Receptionist> {
		const receptionist = await this.receptionistModel
			.findOne({ receptionistNick: input.receptionistNick })
			.select('+receptionistPassword')
			.exec();
		if (!receptionist || receptionist.memberStatus === MemberStatus.DELETE) {
			throw new InternalServerErrorException('Receptionist was not found');
		}
		if (receptionist.memberStatus === MemberStatus.BLOCK) {
			throw new InternalServerErrorException('Receptionist is blocked');
		}

		const isMatch = await this.authService.comparePassword(input.receptionistPassword, receptionist.receptionistPassword);
		if (!isMatch) throw new InternalServerErrorException('Wrong receptionist password');
		receptionist.accessToken = await this.authService.createToken(receptionist);
		return receptionist;
	}

	public async getMyProfile(receptionistId: ObjectId): Promise<Receptionist> {
		const result = await this.receptionistModel
			.findOne({ _id: receptionistId, memberType: MemberType.RECEPTIONIST, memberStatus: MemberStatus.ACTIVE, deletedAt: { $exists: false } })
			.exec();
		if (!result) throw new InternalServerErrorException('Receptionist was not found');
		return result;
	}

	public async updateMyProfile(receptionistId: ObjectId, input: ReceptionistProfileUpdateInput): Promise<Receptionist> {
		const result = await this.receptionistModel
			.findOneAndUpdate(
				{ _id: receptionistId, memberType: MemberType.RECEPTIONIST, memberStatus: MemberStatus.ACTIVE, deletedAt: { $exists: false } },
				{ $set: input },
				{ new: true, runValidators: true },
			)
			.exec();
		if (!result) throw new InternalServerErrorException('Receptionist profile update failed');
		result.accessToken = await this.authService.createToken(result);
		return result;
	}

	public async getReceptionists(input: ReceptionistInquiry): Promise<Receptionists> {
		const match: Record<string, unknown> = { memberType: MemberType.RECEPTIONIST, deletedAt: { $exists: false } };
		if (input.memberStatus) match.memberStatus = input.memberStatus;
		const result = await this.receptionistModel
			.aggregate([
				{ $match: match },
				{ $sort: { createdAt: -1 } },
				{
					$facet: {
						list: [{ $skip: (input.page - 1) * input.limit }, { $limit: input.limit }],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		return result[0] ?? { list: [], metaCounter: [] };
	}

	public async updateByAdmin(input: ReceptionistAdminUpdateInput): Promise<Receptionist> {
		const updateData: Record<string, unknown> = { ...input };
		delete updateData._id;
		const result = await this.receptionistModel
			.findOneAndUpdate(
				{ _id: input._id, memberType: MemberType.RECEPTIONIST, deletedAt: { $exists: false } },
				{ $set: updateData },
				{ new: true, runValidators: true },
			)
			.exec();
		if (!result) throw new InternalServerErrorException('Receptionist update failed');
		return result;
	}

	public async removeByAdmin(receptionistId: ObjectId): Promise<Receptionist> {
		const result = await this.receptionistModel
			.findOneAndUpdate(
				{ _id: receptionistId, memberType: MemberType.RECEPTIONIST, deletedAt: { $exists: false } },
				{ $set: { memberStatus: MemberStatus.DELETE, deletedAt: new Date() } },
				{ new: true },
			)
			.exec();
		if (!result) throw new InternalServerErrorException('Receptionist removal failed');
		return result;
	}

	public async createTask(memberId: ObjectId, memberType: MemberType, input: ReceptionTaskInput): Promise<ReceptionTask> {
		const appointment = await this.appointmentModel
			.findOne({
				_id: input.appointmentId,
				appointmentStatus: { $in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS] },
			})
			.lean()
			.exec();
		if (!appointment) throw new BadRequestException('Reception task requires an active appointment');

		let receptionistId = input.receptionistId;
		if (memberType === MemberType.RECEPTIONIST) {
			if (receptionistId && receptionistId.toString() !== memberId.toString()) {
				throw new ForbiddenException('A receptionist can assign a task only to themselves');
			}
			receptionistId = memberId;
		} else if (receptionistId) {
			await this.ensureReceptionist(receptionistId);
		}

		return await this.receptionTaskModel.create({
			appointmentId: appointment._id,
			patientId: appointment.patientId,
			doctorId: appointment.doctorId,
			receptionistId,
			createdByMemberId: memberId,
			taskType: input.taskType,
			taskPriority: input.taskPriority,
			taskInstruction: input.taskInstruction,
			dueAt: input.dueAt,
			taskStatus: ReceptionTaskStatus.PENDING,
		});
	}

	public async getTasks(memberId: ObjectId, memberType: MemberType, input: ReceptionTaskInquiry): Promise<ReceptionTasks> {
		const match: Record<string, unknown> = {};
		if (memberType === MemberType.RECEPTIONIST) {
			match.$or = [{ receptionistId: memberId }, { receptionistId: { $exists: false } }];
		}
		if (input.taskStatus) match.taskStatus = input.taskStatus;

		const result = await this.receptionTaskModel
			.aggregate([
				{ $match: match },
				{ $sort: { createdAt: -1 } },
				{
					$facet: {
						list: [{ $skip: (input.page - 1) * input.limit }, { $limit: input.limit }],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		return result[0] ?? { list: [], metaCounter: [] };
	}

	public async getTask(memberId: ObjectId, memberType: MemberType, taskId: ObjectId): Promise<ReceptionTask> {
		const task = await this.receptionTaskModel.findById(taskId).exec();
		if (!task) throw new InternalServerErrorException('Reception task was not found');
		this.ensureTaskAccess(memberId, memberType, task.receptionistId, undefined, true);
		return task;
	}

	public async updateTask(memberId: ObjectId, memberType: MemberType, input: ReceptionTaskStatusInput): Promise<ReceptionTask> {
		const task = await this.receptionTaskModel.findById(input.taskId).exec();
		if (!task) throw new InternalServerErrorException('Reception task was not found');
		this.ensureTaskAccess(memberId, memberType, task.receptionistId, input.taskStatus);

		const allowedStatuses: Record<ReceptionTaskStatus, ReceptionTaskStatus[]> = {
			[ReceptionTaskStatus.PENDING]: [ReceptionTaskStatus.ACCEPTED, ReceptionTaskStatus.CANCELLED],
			[ReceptionTaskStatus.ACCEPTED]: [ReceptionTaskStatus.IN_PROGRESS, ReceptionTaskStatus.CANCELLED],
			[ReceptionTaskStatus.IN_PROGRESS]: [ReceptionTaskStatus.COMPLETED, ReceptionTaskStatus.CANCELLED],
			[ReceptionTaskStatus.COMPLETED]: [],
			[ReceptionTaskStatus.CANCELLED]: [],
		};
		if (!allowedStatuses[task.taskStatus].includes(input.taskStatus)) {
			throw new BadRequestException(`Cannot change task status from ${task.taskStatus} to ${input.taskStatus}`);
		}
		if (input.taskStatus === ReceptionTaskStatus.COMPLETED && !input.taskResult?.trim() && !task.taskResult?.trim()) {
			throw new BadRequestException('Task result is required when completing a reception task');
		}

		if (memberType === MemberType.RECEPTIONIST && !task.receptionistId) task.receptionistId = memberId;
		task.statusHistory.push({
			previousStatus: task.taskStatus,
			newStatus: input.taskStatus,
			changedByMemberId: memberId,
			reason: input.reason,
			changedAt: new Date(),
		} as any);
		task.taskStatus = input.taskStatus;
		if (input.taskResult !== undefined) task.taskResult = input.taskResult;
		if (input.taskStatus === ReceptionTaskStatus.ACCEPTED) task.acceptedAt = new Date();
		if (input.taskStatus === ReceptionTaskStatus.COMPLETED) task.completedAt = new Date();

		return await task.save();
	}

	private async ensureReceptionist(receptionistId: ObjectId): Promise<void> {
		const receptionist = await this.receptionistModel
			.findOne({ _id: receptionistId, memberType: MemberType.RECEPTIONIST, memberStatus: MemberStatus.ACTIVE, deletedAt: { $exists: false } })
			.select('_id')
			.lean()
			.exec();
		if (!receptionist) throw new BadRequestException('Assigned member is not an active receptionist');
	}

	private ensureTaskAccess(
		memberId: ObjectId,
		memberType: MemberType,
		receptionistId?: ObjectId,
		nextStatus?: ReceptionTaskStatus,
		allowUnassigned = false,
	): void {
		if (memberType === MemberType.ADMIN) return;
		if (!receptionistId && (allowUnassigned || nextStatus === ReceptionTaskStatus.ACCEPTED)) return;
		if (!receptionistId || receptionistId.toString() !== memberId.toString()) {
			throw new ForbiddenException('This reception task is not assigned to you');
		}
	}
}

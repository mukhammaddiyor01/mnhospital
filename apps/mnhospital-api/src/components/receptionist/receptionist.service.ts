import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Appointment } from '../appointment/dto/appointment';
import { AppointmentStatus } from '../../libs/enums/appointment.enum';
import { Member } from '../member/dto/member';
import { MemberStatus, MemberType } from '../member/enums/member.enum';
import { ReceptionTask, ReceptionTasks } from './dto/reception-task';
import { ReceptionTaskInput, ReceptionTaskInquiry, ReceptionTaskStatusInput } from './dto/reception-task.input';
import { ReceptionTaskStatus } from './enums/receptionist.enum';

@Injectable()
export class ReceptionistService {
	constructor(
		@InjectModel('ReceptionTask') private readonly receptionTaskModel: Model<ReceptionTask>,
		@InjectModel('Appointment') private readonly appointmentModel: Model<Appointment>,
		@InjectModel('Member') private readonly memberModel: Model<Member>,
	) {}

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
		const receptionist = await this.memberModel
			.findOne({ _id: receptionistId, memberType: MemberType.RECEPTIONIST, memberStatus: MemberStatus.ACTIVE })
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

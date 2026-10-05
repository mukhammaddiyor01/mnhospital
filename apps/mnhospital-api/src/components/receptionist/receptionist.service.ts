import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Appointment, Appointments } from '../appointment/dto/appointment';
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
	ReceptionistAppointmentQueueInquiry,
	ReceptionistReportInquiry,
	ReceptionistStatusUpdateInput,
} from './dto/receptionist.input';
import { ReceptionTask, ReceptionTasks } from './dto/reception-task';
import { ReceptionTaskInput, ReceptionTaskInquiry, ReceptionTaskStatusInput } from './dto/reception-task.input';
import { ReceptionTaskStatus } from './enums/receptionist.enum';
import { ReceptionistDashboardStats } from './dto/receptionist-dashboard';
import { DoctorReport, DoctorReports } from '../doctor/doctor-reports/dto/doctor-report';
import { AppointmentService } from '../appointment/appointment.service';
import { NotificationEventService } from '../notification/notification-event.service';
import { NotificationGroup, NotificationType } from '../notification/enums/notification.enum';

@Injectable()
export class ReceptionistService {
	constructor(
		@InjectModel('ReceptionTask') private readonly receptionTaskModel: Model<ReceptionTask>,
		@InjectModel('Appointment') private readonly appointmentModel: Model<Appointment>,
		@InjectModel('Receptionist') private readonly receptionistModel: Model<Receptionist>,
		@InjectModel('DoctorReport') private readonly doctorReportModel: Model<DoctorReport>,
		private readonly authService: AuthService,
		private readonly appointmentService: AppointmentService,
		private readonly notificationEvents: NotificationEventService,
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

	public async getReceptionistByAdmin(receptionistId: ObjectId): Promise<Receptionist> {
		const receptionist = await this.receptionistModel
			.findOne({ _id: receptionistId, memberType: MemberType.RECEPTIONIST })
			.exec();
		if (!receptionist) throw new InternalServerErrorException('Receptionist was not found');
		return receptionist;
	}

	public async getDashboardStats(receptionistId: ObjectId): Promise<ReceptionistDashboardStats> {
		const receptionist = await this.receptionistModel
			.findOne({ _id: receptionistId, memberType: MemberType.RECEPTIONIST, deletedAt: { $exists: false } })
			.select('_id memberStatus')
			.lean()
			.exec();
		if (!receptionist) throw new InternalServerErrorException('Receptionist was not found');

		const taskMatch = { receptionistId };
		const [taskCount, pendingTaskCount, acceptedTaskCount, inProgressTaskCount, completedTaskCount, cancelledTaskCount] =
			await Promise.all([
				this.receptionTaskModel.countDocuments(taskMatch).exec(),
				this.receptionTaskModel.countDocuments({ ...taskMatch, taskStatus: ReceptionTaskStatus.PENDING }).exec(),
				this.receptionTaskModel.countDocuments({ ...taskMatch, taskStatus: ReceptionTaskStatus.ACCEPTED }).exec(),
				this.receptionTaskModel.countDocuments({ ...taskMatch, taskStatus: ReceptionTaskStatus.IN_PROGRESS }).exec(),
				this.receptionTaskModel.countDocuments({ ...taskMatch, taskStatus: ReceptionTaskStatus.COMPLETED }).exec(),
				this.receptionTaskModel.countDocuments({ ...taskMatch, taskStatus: ReceptionTaskStatus.CANCELLED }).exec(),
			]);

		return {
			receptionistId: receptionist._id,
			memberStatus: receptionist.memberStatus,
			taskCount,
			pendingTaskCount,
			acceptedTaskCount,
			inProgressTaskCount,
			completedTaskCount,
			cancelledTaskCount,
		};
	}

	public async getMyReports(receptionistId: ObjectId, input: ReceptionistReportInquiry): Promise<DoctorReports> {
		const taskMatch: Record<string, unknown> = {
			receptionistId,
			taskStatus: { $ne: ReceptionTaskStatus.CANCELLED },
		};
		if (input.patientId) taskMatch.patientId = input.patientId;

		const tasks = await this.receptionTaskModel.find(taskMatch).select('appointmentId').lean().exec();
		const appointmentIds = tasks.map((task) => task.appointmentId).filter(Boolean);
		if (!appointmentIds.length) return { list: [], metaCounter: [] };

		const result = await this.doctorReportModel
			.aggregate([
				{ $match: { appointmentId: { $in: appointmentIds } } },
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

	public async getMyAppointmentQueue(
		receptionistId: ObjectId,
		input: ReceptionistAppointmentQueueInquiry,
	): Promise<Appointments> {
		const appointmentIds = await this.receptionTaskModel.distinct('appointmentId', {
			receptionistId,
			taskStatus: { $nin: [ReceptionTaskStatus.CANCELLED, ReceptionTaskStatus.COMPLETED] },
		});
		if (!appointmentIds.length) return { list: [], metaCounter: [] };

		const match: Record<string, unknown> = {
			_id: { $in: appointmentIds },
			appointmentStatus: {
				$in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS],
			},
		};
		if (input.status) match.appointmentStatus = input.status;

		const result = await this.appointmentModel
			.aggregate([
				{ $match: match },
				{ $sort: { startsAt: 1 } },
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

	public async checkInAppointment(receptionistId: ObjectId, appointmentId: ObjectId, reason?: string): Promise<Appointment> {
		const task = await this.receptionTaskModel
			.findOne({ appointmentId, receptionistId, taskStatus: ReceptionTaskStatus.ACCEPTED })
			.select('_id')
			.exec();
		if (!task) throw new ForbiddenException('Appointment requires an accepted reception task');

		const appointment = await this.appointmentService.updateAppointmentStatus(
			receptionistId,
			MemberType.RECEPTIONIST,
			appointmentId,
			AppointmentStatus.IN_PROGRESS,
			reason,
		);

		await this.updateTask(receptionistId, MemberType.RECEPTIONIST, {
			taskId: task._id,
			taskStatus: ReceptionTaskStatus.IN_PROGRESS,
			reason,
		});
		return appointment;
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

	public async updateStatusByAdmin(input: ReceptionistStatusUpdateInput): Promise<Receptionist> {
		const receptionist = await this.receptionistModel
			.findOne({ _id: input._id, memberType: MemberType.RECEPTIONIST, deletedAt: { $exists: false } })
			.exec();
		if (!receptionist) throw new InternalServerErrorException('Receptionist was not found');

		const updateData: Record<string, unknown> = { memberStatus: input.memberStatus };
		if (input.memberStatus === MemberStatus.DELETE) updateData.deletedAt = new Date();

		const result = await this.receptionistModel
			.findOneAndUpdate({ _id: input._id, memberType: MemberType.RECEPTIONIST }, { $set: updateData }, { new: true, runValidators: true })
			.exec();
		if (!result) throw new InternalServerErrorException('Receptionist status update failed');
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

		const task = await this.receptionTaskModel.create({
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
		if (receptionistId) {
			await this.notificationEvents.toReceptionist(receptionistId, {
				key: `reception-task:${task._id}:assigned`,
				type: NotificationType.SYSTEM,
				group: NotificationGroup.RECEPTION_TASK,
				title: 'Reception task assigned',
				description: 'A reception task is ready for review.',
				refId: task._id,
				authorId: memberId,
				authorType: memberType,
			});
		}
		return task;
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

		const result = await task.save();
		if (input.taskStatus === ReceptionTaskStatus.COMPLETED) {
			await this.notificationEvents.toDoctor(result.doctorId, {
				key: `reception-task:${result._id}:completed`,
				type: NotificationType.SYSTEM,
				group: NotificationGroup.RECEPTION_TASK,
				title: 'Reception task completed',
				description: 'A reception task for your appointment was completed.',
				refId: result._id,
				authorId: memberId,
				authorType: memberType,
			});
		}
		return result;
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

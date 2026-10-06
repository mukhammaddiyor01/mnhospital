import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Doctor, Doctors } from './dto/doctor';
import { AdminDoctorInquiry, DoctorInput, DoctorLoginInput, DoctorsInquiry } from './dto/doctor.input';
import { StatisticModifier, T } from '../../libs/types/common';
import { Direction, Message } from '../../libs/enums/common.enum';
import { lookupAuthMemberLiked } from '../../libs/config';
import { AuthService } from '../auth/auth.service';
import { MemberStatus, MemberType } from '../member/enums/member.enum';
import { LikeService } from '../like/like.service';
import { LikeInput } from '../like/dto/like.input';
import { LikeGroup } from '../like/enums/like.enum';
import { Follower, Following, MeFollowed } from '../follow/dto/follow';
import { Service } from '../service/dto/service';
import { Appointment } from '../appointment/dto/appointment';
import { DoctorReport } from './doctor-reports/dto/doctor-report';
import { ServiceStatus } from '../service/enums/service.enum';
import { AppointmentStatus } from '../../libs/enums/appointment.enum';
import { DoctorDashboardStats } from './dto/doctor-dashboard';
import { DoctorProfileUpdateInput } from './dto/doctor-profile.input';

@Injectable()
export class DoctorService {
	constructor(
		@InjectModel('Doctor') private readonly doctorModel: Model<Doctor>,
		@InjectModel('Follow') private readonly followModel: Model<Follower | Following>,
		@InjectModel('DoctorFollow') private readonly doctorFollowModel: Model<Doctor>,
		@InjectModel('Service') private readonly serviceModel: Model<Service>,
		@InjectModel('Appointment') private readonly appointmentModel: Model<Appointment>,
		@InjectModel('DoctorReport') private readonly doctorReportModel: Model<DoctorReport>,
		private readonly authService: AuthService,
		private readonly likeService: LikeService,
	) {}

	public async getMyProfile(doctorId: ObjectId): Promise<Doctor> {
		const doctor = await this.doctorModel
			.findOne({ _id: doctorId, memberType: MemberType.DOCTOR, memberStatus: MemberStatus.ACTIVE, deletedAt: { $exists: false } })
			.exec();
		if (!doctor) throw new InternalServerErrorException('Doctor was not found');
		return doctor;
	}

	public async updateMyProfile(doctorId: ObjectId, input: DoctorProfileUpdateInput): Promise<Doctor> {
		const updates: Record<string, string> = {};
		for (const key of ['docFullName', 'docPhone', 'docMail', 'docAddress', 'docDesc'] as const) {
			if (input[key] !== undefined) updates[key] = input[key];
		}
		if (!Object.keys(updates).length) throw new BadRequestException('No profile changes were provided');
		const clearEmail = updates.docMail === '';
		if (clearEmail) delete updates.docMail;

		let doctor: Doctor;
		try {
			doctor = await this.doctorModel.findOneAndUpdate(
				{ _id: doctorId, memberType: MemberType.DOCTOR, memberStatus: MemberStatus.ACTIVE, deletedAt: { $exists: false } },
				{ $set: updates, ...(clearEmail ? { $unset: { docMail: 1 } } : {}) },
				{ new: true, runValidators: true },
			).exec();
		} catch (err) {
			if (err.code === 11000) throw new BadRequestException(Message.USED_DOCTOR_NICK_PHONE_OR_MAIL);
			throw err;
		}
		if (!doctor) throw new InternalServerErrorException('Doctor profile update failed');
		doctor.accessToken = await this.authService.createToken(doctor);
		return doctor;
	}

	public async createDoctorByAdmin(input: DoctorInput): Promise<Doctor> {
		const createData: DoctorInput = {
			...input,
			docPassword: await this.authService.hashPassword(input.docPassword),
		};

		try {
			const doctor = await this.doctorModel.create(createData);
			doctor.accessToken = await this.authService.createToken(doctor);
			return doctor;
		} catch (err) {
			console.log('Error, DoctorService.createDoctorByAdmin:', err.message);
			throw new BadRequestException(Message.USED_DOCTOR_NICK_PHONE_OR_MAIL);
		}
	}

	public async loginDoctor(input: DoctorLoginInput): Promise<Doctor> {
		const doctor = await this.doctorModel.findOne({ docNick: input.docNick }).select('+docPassword').exec();

		if (!doctor || doctor.memberStatus === MemberStatus.DELETE) {
			throw new InternalServerErrorException(Message.NO_DOCTOR_NICK);
		}
		if (doctor.memberStatus === MemberStatus.BLOCK) {
			throw new InternalServerErrorException(Message.BLOCKED_USER);
		}

		const isMatch = await this.authService.comparePassword(input.docPassword, doctor.docPassword);
		if (!isMatch) throw new InternalServerErrorException(Message.WRONG_PASSWORD);

		doctor.accessToken = await this.authService.createToken(doctor);
		return doctor;
	}

	public async updateStatusByAdmin(doctorId: ObjectId, memberStatus: MemberStatus): Promise<Doctor> {
		const doctor = await this.doctorModel
			.findOne({ _id: doctorId, memberType: MemberType.DOCTOR, deletedAt: { $exists: false } })
			.exec();
		if (!doctor) throw new InternalServerErrorException('Doctor was not found');
		if (doctor.memberStatus === MemberStatus.DELETE) {
			throw new BadRequestException('Deleted doctor status cannot be changed');
		}

		const updateData: Record<string, unknown> = { memberStatus };
		if (memberStatus === MemberStatus.DELETE) updateData.deletedAt = new Date();

		const result = await this.doctorModel
			.findOneAndUpdate({ _id: doctorId, memberType: MemberType.DOCTOR }, { $set: updateData }, { new: true, runValidators: true })
			.exec();
		if (!result) throw new InternalServerErrorException('Doctor status update failed');
		return result;
	}

	public async getDashboardStats(doctorId: ObjectId): Promise<DoctorDashboardStats> {
		const doctor = await this.doctorModel
			.findOne({ _id: doctorId, memberType: MemberType.DOCTOR, deletedAt: { $exists: false } })
			.select('_id memberStatus')
			.lean()
			.exec();
		if (!doctor) throw new InternalServerErrorException('Doctor was not found');

		const [serviceCount, appointmentCount, completedAppointmentCount, reportCount, patientCounter] = await Promise.all([
			this.serviceModel.countDocuments({ memberId: doctorId, serviceStatus: { $ne: ServiceStatus.DELETED } }).exec(),
			this.appointmentModel.countDocuments({ doctorId }).exec(),
			this.appointmentModel
				.countDocuments({ doctorId, appointmentStatus: { $in: [AppointmentStatus.ENDED, AppointmentStatus.COMPLETED] } })
				.exec(),
			this.doctorReportModel.countDocuments({ doctorId }).exec(),
			this.appointmentModel
				.aggregate([
					{
						$match: {
							doctorId,
							appointmentStatus: { $nin: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
						},
					},
					{ $group: { _id: '$patientId' } },
					{ $count: 'total' },
				])
				.exec(),
		]);

		return {
			doctorId: doctor._id,
			memberStatus: doctor.memberStatus,
			serviceCount,
			patientCount: patientCounter[0]?.total ?? 0,
			appointmentCount,
			completedAppointmentCount,
			reportCount,
		};
	}

	public async getDoctors(input: DoctorsInquiry, memberId?: ObjectId): Promise<Doctors> {
		const { text } = input.search;
		const match: T = {
			memberStatus: MemberStatus.ACTIVE,
			deletedAt: { $exists: false },
		};
		const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };

		if (input.docSpecialty) match.docSpecialty = input.docSpecialty;
		if (text) {
			const searchRegex = new RegExp(text, 'i');
			match.$or = [{ docNick: searchRegex }, { docFullName: searchRegex }];
		}
		console.log('match:', match);

		const result = await this.doctorModel
			.aggregate([
				{ $match: match },
				{ $sort: sort },
				{
					$facet: {
						list: [
							{ $skip: (input.page - 1) * input.limit },
							{ $limit: input.limit },
							...(memberId ? [lookupAuthMemberLiked(memberId, '$_id', LikeGroup.DOCTOR)] : []),
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		if (memberId && result[0].list?.length) {
			result[0].list = await Promise.all(
				result[0].list.map(async (doctor: Doctor) => {
					doctor.meFollowed = await this.checkSubscription(memberId, doctor._id);
					return doctor;
				}),
			);
		}
		return result[0];
	}

	public async getDoctor(targetId: ObjectId, memberId?: ObjectId): Promise<Doctor> {
		const doctor = await this.doctorModel
			.findOne({
				_id: targetId,
				memberStatus: { $in: [MemberStatus.ACTIVE, MemberStatus.BLOCK] },
				deletedAt: { $exists: false },
			})
			.lean()
			.exec();

		if (!doctor) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		if (memberId) {
			doctor.meLiked = await this.likeService.checkLikeExistence({
				memberId,
				likeRefId: targetId,
				likeGroup: LikeGroup.DOCTOR,
			});
			doctor.meFollowed = await this.checkSubscription(memberId, targetId);
		}
		return doctor;
	}

	public async getDoctorsByAdmin(input: AdminDoctorInquiry): Promise<Doctors> {
		const match: T = { memberType: MemberType.DOCTOR };
		if (input.memberStatus) match.memberStatus = input.memberStatus;
		if (input.docSpecialty) match.docSpecialty = input.docSpecialty;
		if (input.text) {
			const searchRegex = new RegExp(input.text, 'i');
			match.$or = [{ docNick: searchRegex }, { docFullName: searchRegex }, { docMail: searchRegex }];
		}

		const result = await this.doctorModel
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

	public async getDoctorByAdmin(doctorId: ObjectId): Promise<Doctor> {
		const doctor = await this.doctorModel.findOne({ _id: doctorId, memberType: MemberType.DOCTOR }).exec();
		if (!doctor) throw new InternalServerErrorException('Doctor was not found');
		return doctor;
	}

	public async checkSubscription(followerId: ObjectId, followingId: ObjectId): Promise<MeFollowed[]> {
		const result = await this.doctorFollowModel.findOne({ doctorId: followingId, memberId: followerId }).exec();
		return result ? [{ followerId: followerId, followingId: followingId, myFollowing: true }] : [];
	}

	public async likeTargetDoctor(memberId: ObjectId, doctorId: ObjectId): Promise<Doctor> {
		const targetDoctor = await this.doctorModel
			.findOne({
				_id: doctorId,
				memberStatus: MemberStatus.ACTIVE,
				deletedAt: { $exists: false },
			})
			.exec();
		if (!targetDoctor) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const likeInput: LikeInput = {
			memberId,
			likeRefId: doctorId,
			likeGroup: LikeGroup.DOCTOR,
		};
		const modifier = await this.likeService.toggleLike(likeInput);
		const result = await this.doctorStatisticEditor({
			_id: doctorId,
			targetKey: 'docLikes',
			modifier,
		});

		if (!result) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
		return result;
	}

	public async doctorStatisticEditor(input: StatisticModifier): Promise<Doctor> {
		const { _id, targetKey, modifier } = input;

		const allowedKeys = ['docPoints', 'docPatients', 'docServices', 'docArticles', 'docLikes', 'docFollowers', 'docFollowings', 'docComments'];

		if (!allowedKeys.includes(targetKey)) {
			throw new BadRequestException('Invalid doctor statistic key');
		}

		const search: T = { _id };
		if (targetKey !== 'docServices') search.memberStatus = MemberStatus.ACTIVE;

		if (['docServices', 'docArticles', 'docLikes', 'docFollowers', 'docFollowings', 'docComments'].includes(targetKey) && modifier < 0) {
			search[targetKey] = { $gte: Math.abs(modifier) };
		}

		let result = await this.doctorModel
			.findOneAndUpdate(search, { $inc: { [targetKey]: modifier } }, { new: true })
			.exec();

		if (!result && ['docServices', 'docArticles', 'docLikes', 'docFollowers', 'docFollowings', 'docComments'].includes(targetKey) && modifier < 0) {
			result = await this.doctorModel.findOne({ _id }).exec();
		}

		if (!result) {
			throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		}

		return result;
	}
}

import { validateServiceAvailability } from '../service/service-availability.policy';
import { CommentStatus } from '../comment/enums/comment.enum';
import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import moment = require('moment');
import { Member, Members } from '../member/dto/member';
import { Admin } from './dto/admin';
import { AdminLoginInput } from './dto/admin.input';
import { MembersInquiry } from '../member/dto/member.input';
import { Service, Services } from '../service/dto/service';
import { ServiceSearch, ServicesInquiry } from '../service/dto/service.input';
import { ServiceUpdate } from '../service/dto/service.update';
import { ServiceStatus, MAX_SERVICES_PER_TYPE } from '../service/enums/service.enum';
import { DoctorService } from '../doctor/doctor.service';
import { assertSpecialtyServiceType } from '../doctor/doctor-specialty.policy';
import { AuthService } from '../auth/auth.service';
import { Direction, Message } from '../../libs/enums/common.enum';
import { MemberStatus, MemberType } from '../member/enums/member.enum';
import { lookupDoctor, shapeIntoMongoObjectId } from '../../libs/config';
import { T } from '../../libs/types/common';
import { MemberUpdate } from '../member/dto/member.update';
import { Article, Articles } from '../article/dto/article';
import { ArticleSearch, ArticlesInquiry } from '../article/dto/article.input';
import { ArticleUpdate } from '../article/dto/article.update';
import { ArticleStatus } from '../article/enums/article.enum';
import { Comments } from '../comment/dto/comment';
import { OrdinaryInquiry } from '../service/dto/service.input';
import { Comment } from '../comment/dto/comment';
import { AdminDashboardStats } from './dto/admin-dashboard';
import { Patient } from '../patient/dto/patient';
import { Doctor } from '../doctor/dto/doctor';
import { Receptionist } from '../receptionist/dto/receptionist';
import { BookingOrder } from '../booking/dto/booking-order';
import { Appointment } from '../appointment/dto/appointment';
import { PatientActivity } from './dto/patient-activity';

@Injectable()
export class AdminService {
	constructor(
		@InjectModel('Admin') private readonly adminModel: Model<Admin>,
		@InjectModel('Member') private readonly memberModel: Model<Member>,
		@InjectModel('Patient') private readonly patientModel: Model<Patient>,
		@InjectModel('Doctor') private readonly doctorModel: Model<Doctor>,
		@InjectModel('Receptionist') private readonly receptionistModel: Model<Receptionist>,
		@InjectModel('BookingOrder') private readonly bookingOrderModel: Model<BookingOrder>,
		@InjectModel('Appointment') private readonly appointmentModel: Model<Appointment>,
		@InjectModel('Service') private readonly serviceModel: Model<Service>,
		@InjectModel('Article') private readonly articleModel: Model<Article>,
		@InjectModel('Comment') private readonly commentModel: Model<Comment>,
		private readonly doctorService: DoctorService,
		private readonly authService: AuthService,
	) {}

	public async loginAdmin(input: AdminLoginInput): Promise<Admin> {
		const admin = await this.adminModel
			.findOne({ adminNick: input.adminNick, memberType: MemberType.ADMIN, deletedAt: { $exists: false } })
			.select('+adminPassword')
			.exec();
		if (!admin || admin.deletedAt) throw new UnauthorizedException('Invalid admin credentials');

		const isMatch = await this.authService.comparePassword(input.adminPassword, admin.adminPassword);
		if (!isMatch) throw new UnauthorizedException('Invalid admin credentials');

		admin.memberType = MemberType.ADMIN;

		return admin;
	}

	public async getMyProfile(adminId: ObjectId): Promise<Admin> {
		const admin = await this.adminModel
			.findOne({ _id: adminId, memberType: MemberType.ADMIN, deletedAt: { $exists: false } })
			.exec();
		if (!admin) throw new InternalServerErrorException('Admin was not found');
		return admin;
	}

	public async getDashboardStats(): Promise<AdminDashboardStats> {
		const registeredFilter = { deletedAt: { $exists: false } };
		const activeFilter = { ...registeredFilter, memberStatus: MemberStatus.ACTIVE };

		const [
			totalPatients,
			activePatients,
			totalDoctors,
			activeDoctors,
			totalReceptionists,
			activeReceptionists,
			totalBookings,
			totalAppointments,
		] = await Promise.all([
			this.patientModel.countDocuments(registeredFilter).exec(),
			this.patientModel.countDocuments(activeFilter).exec(),
			this.doctorModel.countDocuments(registeredFilter).exec(),
			this.doctorModel.countDocuments(activeFilter).exec(),
			this.receptionistModel.countDocuments(registeredFilter).exec(),
			this.receptionistModel.countDocuments(activeFilter).exec(),
			this.bookingOrderModel.countDocuments({}).exec(),
			this.appointmentModel.countDocuments({}).exec(),
		]);

		return {
			totalPatients,
			activePatients,
			totalDoctors,
			activeDoctors,
			totalReceptionists,
			activeReceptionists,
			totalBookings,
			totalAppointments,
		};
	}

	public async getPatientActivityByAdmin(patientId: ObjectId): Promise<PatientActivity> {
		const patient = await this.patientModel.findOne({ _id: patientId }).lean().exec();
		if (!patient) throw new InternalServerErrorException('Patient was not found');

		const [bookingOrders, appointments] = await Promise.all([
			this.bookingOrderModel.find({ patientId }).sort({ createdAt: -1 }).lean().exec(),
			this.appointmentModel.find({ patientId }).sort({ startsAt: -1 }).lean().exec(),
		]);

		const serviceIds = [
			...bookingOrders.flatMap((order) => order.bookingOrderItems?.map((item) => item.serviceId) ?? []),
			...appointments.map((appointment) => appointment.serviceId?.toString()),
		]
			.filter((serviceId): serviceId is string => Boolean(serviceId) && Types.ObjectId.isValid(serviceId))
			.map((serviceId) => new ObjectId(serviceId));
		const uniqueServiceIds = [...new Map(serviceIds.map((serviceId) => [serviceId.toString(), serviceId])).values()];
		const services = uniqueServiceIds.length
			? await this.serviceModel
					.find({ _id: { $in: uniqueServiceIds } })
					.sort({ createdAt: -1 })
					.lean()
					.exec()
			: [];

		return { patient, bookingOrders, services, appointments };
	}

	/** MEMBERS */

	public async getAllMembersByAdmin(input: MembersInquiry): Promise<Members> {
		const { memberStatus, memberType, text } = input?.search;
		const match: T = {};
		const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };

		if (memberStatus) match.memberStatus = memberStatus;
		if (memberType) match.memberType = memberType;

		if (text) match.memberNick = { $regex: new RegExp(text, 'i') };
		console.log('match', match);

		const result = await this.memberModel
			.aggregate([
				{ $match: match },
				{ $sort: sort },
				{
					$facet: {
						list: [{ $skip: (input.page - 1) * input.limit }, { $limit: input.limit }],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		return result[0];
	}

	public async updateMemberByAdmin(input: MemberUpdate): Promise<Member> {
		if (input.memberType !== undefined && input.memberType !== MemberType.PATIENT)
			throw new BadRequestException('Staff accounts use their separate administration APIs');
		const update: T = {};
		for (const key of [
			'memberStatus',
			'memberPhone',
			'memberMail',
			'memberNick',
			'memberFullName',
			'memberImage',
			'memberDesc',
			'memberAddress',
		]) {
			if (input[key] !== undefined) update[key] = input[key];
		}
		if (!Object.keys(update).length) throw new BadRequestException('No account changes were provided');
		if (input.memberStatus === MemberStatus.DELETE) update.deletedAt = new Date();
		const revoke = input.memberStatus !== undefined && input.memberStatus !== MemberStatus.ACTIVE;
		const result: Member = await this.memberModel
			.findOneAndUpdate(
				{
					_id: input._id,
					memberType: MemberType.PATIENT,
					memberStatus: { $ne: MemberStatus.DELETE },
					deletedAt: { $exists: false },
				},
				{ $set: update, ...(revoke ? { $inc: { sessionVersion: 1 } } : {}) },
				{ new: true, runValidators: true },
			)
			.exec();
		if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);
		if (revoke) await this.authService.revokeOwnerSessions(input._id, MemberType.PATIENT);
		return result;
	}

	/** SERVICES */

	public async getAllServicesByAdmin(input: ServicesInquiry): Promise<Services> {
		const match: T = {};
		this.shapeServiceMatchQuery(match, input.search);

		const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };
		const result = await this.serviceModel
			.aggregate([
				{ $match: match },
				{ $sort: sort },
				{
					$facet: {
						list: [
							{ $skip: (input.page - 1) * input.limit },
							{ $limit: input.limit },
							lookupDoctor,
							{ $unwind: { path: '$memberData', preserveNullAndEmptyArrays: true } },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		return result[0];
	}

	public async updateServiceByAdmin(input: ServiceUpdate): Promise<Service> {
		const { serviceStatus } = input;
		let deletedAt: Date | undefined;
		const search: T = {
			_id: input._id,
			serviceStatus: { $ne: ServiceStatus.DELETED },
		};

		const currentService = await this.serviceModel.findOne(search).exec();
		if (!currentService) throw new InternalServerErrorException(Message.UPDATE_FAILED);
		if (currentService.packageItems?.length > 1) {
			const duration = currentService.packageItems.reduce((sum, item) => sum + item.duration, 0);
			if (
				Number(input.serviceDuration ?? currentService.serviceDuration) < duration ||
				Number(input.servicePrice ?? currentService.servicePrice) >= currentService.packageRegularPrice
			)
				throw new BadRequestException('Use a valid full package price and duration');
			for (const field of ['memberId', 'departmentId', 'serviceType', 'serviceRoom'])
				if (input[field] !== undefined && String(input[field]) !== String(currentService[field]))
					throw new BadRequestException('Package ownership and room follow its standard service');
		}

		validateServiceAvailability({
			availabilityDates: input.availabilityDates !== undefined ? input.availabilityDates : currentService.availabilityDates,
			openedAt: input.openedAt ?? currentService.openedAt,
			closedAt: input.closedAt ?? currentService.closedAt,
		});
		if (input.serviceType !== undefined || input.serviceStatus === ServiceStatus.ACTIVE) {
			const doctor = await this.doctorService.getDoctorByAdmin(currentService.memberId);
			assertSpecialtyServiceType(doctor.docSpecialty, input.serviceType ?? currentService.serviceType);
		}

		if (
			serviceStatus !== ServiceStatus.DELETED &&
			input.serviceType &&
			input.serviceType !== currentService.serviceType
		) {
			const sameTypeServiceCount = await this.serviceModel
				.countDocuments({
					_id: { $ne: currentService._id },
					memberId: currentService.memberId,
					serviceType: input.serviceType,
					serviceStatus: { $ne: ServiceStatus.DELETED },
				})
				.exec();

			if (sameTypeServiceCount >= MAX_SERVICES_PER_TYPE) {
				throw new BadRequestException(Message.SERVICE_TYPE_LIMIT_REACHED);
			}
		}

		if (serviceStatus === ServiceStatus.DELETED) deletedAt = moment().toDate();

		const updateData: T = { ...input };
		delete updateData._id;
		if (deletedAt) updateData.deletedAt = deletedAt;

		const result = await this.serviceModel
			.findOneAndUpdate(search, { $set: updateData }, { new: true, runValidators: true })
			.exec();
		if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);

		if (serviceStatus === ServiceStatus.DELETED) {
			try {
				await this.doctorService.doctorStatisticEditor({
					_id: currentService.memberId,
					targetKey: 'docServices',
					modifier: -1,
				});
			} catch (err) {
				await this.serviceModel
					.findByIdAndUpdate(currentService._id, {
						$set: { serviceStatus: currentService.serviceStatus },
						$unset: { deletedAt: 1 },
					})
					.exec();
				throw err;
			}
		}

		return result;
	}

	public async removeServiceByAdmin(serviceId: ObjectId): Promise<Service> {
		const search: T = {
			_id: serviceId,
			serviceStatus: { $ne: ServiceStatus.DELETED },
		};
		const currentService = await this.serviceModel.findOne(search).exec();
		if (!currentService) throw new InternalServerErrorException(Message.REMOVE_FAILED);

		const result = await this.serviceModel
			.findOneAndUpdate(
				search,
				{ $set: { serviceStatus: ServiceStatus.DELETED, deletedAt: moment().toDate() } },
				{ new: true },
			)
			.exec();
		if (!result) throw new InternalServerErrorException(Message.REMOVE_FAILED);

		try {
			await this.doctorService.doctorStatisticEditor({
				_id: currentService.memberId,
				targetKey: 'docServices',
				modifier: -1,
			});
		} catch (err) {
			await this.serviceModel
				.findByIdAndUpdate(currentService._id, {
					$set: { serviceStatus: currentService.serviceStatus },
					$unset: { deletedAt: 1 },
				})
				.exec();
			throw err;
		}

		return result;
	}

	private shapeServiceMatchQuery(match: T, search: ServiceSearch): void {
		const {
			memberId,
			departmentId,
			serviceTypeList,
			serviceStatusList,
			serviceRoomNameList,
			serviceRoomList,
			periodsRange,
			priceRange,
			text,
		} = search;

		if (memberId) match.memberId = shapeIntoMongoObjectId(memberId);
		if (departmentId) match.departmentId = shapeIntoMongoObjectId(departmentId);
		if (serviceTypeList) match.serviceType = { $in: serviceTypeList };
		if (serviceStatusList) match.serviceStatus = { $in: serviceStatusList };
		if (serviceRoomNameList) match.serviceRoomName = { $in: serviceRoomNameList };
		if (serviceRoomList) match.serviceRoom = { $in: serviceRoomList };
		if (priceRange) match.servicePrice = { $gte: priceRange.start, $lte: priceRange.end };
		if (periodsRange) match.createdAt = { $gte: periodsRange.start, $lte: periodsRange.end };

		if (text) {
			const searchRegex = new RegExp(text, 'i');
			match.$or = [{ serviceName: searchRegex }, { serviceTitle: searchRegex }, { serviceDesc: searchRegex }];
		}
	}

	/** ARTICLES */

	public async getAllArticlesByAdmin(input: ArticlesInquiry): Promise<Articles> {
		const match: T = {};
		this.shapeArticleMatchQuery(match, input.search);

		const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };
		const result = await this.articleModel
			.aggregate([
				{ $match: match },
				{ $sort: sort },
				{
					$facet: {
						list: [
							{ $skip: (input.page - 1) * input.limit },
							{ $limit: input.limit },
							lookupDoctor,
							{ $unwind: { path: '$memberData', preserveNullAndEmptyArrays: true } },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		return result[0];
	}

	public async updateArticleByAdmin(input: ArticleUpdate): Promise<Article> {
		const { _id, articleStatus } = input;
		const search: T = { _id, articleStatus: { $ne: ArticleStatus.ARCHIVED } };
		const currentArticle = await this.articleModel.findOne(search).exec();
		if (!currentArticle) throw new InternalServerErrorException(Message.UPDATE_FAILED);

		const updateData: T = { ...input };
		delete updateData._id;
		const result = await this.articleModel
			.findOneAndUpdate(search, { $set: updateData }, { new: true, runValidators: true })
			.exec();
		if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);

		if (articleStatus === ArticleStatus.ARCHIVED) {
			try {
				await this.doctorService.doctorStatisticEditor({
					_id: currentArticle.memberId,
					targetKey: 'docArticles',
					modifier: -1,
				});
			} catch (err) {
				await this.articleModel
					.findByIdAndUpdate(currentArticle._id, { $set: { articleStatus: currentArticle.articleStatus } })
					.exec();
				throw err;
			}
		}

		return result;
	}

	public async removeArticleByAdmin(articleId: ObjectId): Promise<Article> {
		const currentArticle = await this.articleModel.findById(articleId).exec();
		if (!currentArticle) throw new InternalServerErrorException(Message.REMOVE_FAILED);
		if (currentArticle.articleStatus === ArticleStatus.ARCHIVED) return currentArticle;

		const search: T = { _id: articleId, articleStatus: { $ne: ArticleStatus.ARCHIVED } };

		const result = await this.articleModel
			.findOneAndUpdate(search, { $set: { articleStatus: ArticleStatus.ARCHIVED } }, { new: true })
			.exec();
		if (!result) throw new InternalServerErrorException(Message.REMOVE_FAILED);

		try {
			await this.doctorService.doctorStatisticEditor({
				_id: currentArticle.memberId,
				targetKey: 'docArticles',
				modifier: -1,
			});
		} catch (err) {
			await this.articleModel
				.findByIdAndUpdate(currentArticle._id, { $set: { articleStatus: currentArticle.articleStatus } })
				.exec();
			throw err;
		}

		return result;
	}

	private shapeArticleMatchQuery(match: T, search: ArticleSearch): void {
		const { memberId, articleStatus, articleCategoryList, periodsRange, text } = search;

		if (memberId) match.memberId = shapeIntoMongoObjectId(memberId);
		if (articleStatus) match.articleStatus = articleStatus;
		if (articleCategoryList) match.articleCategory = { $in: articleCategoryList };
		if (periodsRange) match.createdAt = { $gte: periodsRange.start, $lte: periodsRange.end };
		if (text) {
			const searchRegex = new RegExp(text, 'i');
			match.$or = [{ articleTitle: searchRegex }, { articleContent: searchRegex }];
		}
	}

	/** COMMENT */

	public async removeCommentByAdmin(input: ObjectId): Promise<Comment> {
		const result = await this.commentModel.findByIdAndDelete(input);
		if (!result) throw new InternalServerErrorException(Message.REMOVE_FAILED);
		return result;
	}
	public async getCommentsByAdmin(input: OrdinaryInquiry): Promise<Comments> {
		const result = await this.commentModel
			.aggregate([
				{ $match: { commentStatus: { $ne: CommentStatus.DELETED } } },
				{ $sort: { createdAt: -1, _id: -1 } },
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
}

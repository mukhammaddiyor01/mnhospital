import { discountedServicePrice } from '../booking/pricing.policy';
import { clinicCurrency } from '../../libs/booking/clinic-time';
import { ServiceOptionInput, ServiceOptionUpdateInput } from './dto/service.option.input';
import { MemberStatus } from '../member/enums/member.enum';
import { validateServiceAvailability } from './service-availability.policy';
import { BadRequestException, HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AuthService } from '../auth/auth.service';
import { ViewService } from '../view/view.service';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Service, Services } from './dto/service';
import { MemberService } from '../member/member.service';
import { DoctorServicesInquiry, OrdinaryInquiry, ServiceInput, ServicesInquiry } from './dto/service.input';
import { Direction, Message } from '../../libs/enums/common.enum';
import { StatisticModifier, T } from '../../libs/types/common';
import { MAX_SERVICES_PER_TYPE, ServiceStatus, ServiceType } from './enums/service.enum';
import { assertSpecialtyServiceType, serviceTypesForSpecialty } from '../doctor/doctor-specialty.policy';
import { ViewGroup } from '../view/enums/view.enum';
import { ServiceUpdate } from './dto/service.update';
import { DoctorService } from '../doctor/doctor.service';
import moment = require('moment');
import { lookupAuthMemberLiked, lookupDoctor, shapeIntoMongoObjectId } from '../../libs/config';
import { LikeService } from '../like/like.service';
import { LikeInput } from '../like/dto/like.input';
import { LikeGroup } from '../like/enums/like.enum';

@Injectable()
export class ServiceService {
	constructor(
		@InjectModel('Service') private readonly serviceModel: Model<Service>,
		private memberService: MemberService,
		private doctorService: DoctorService,
		private authService: AuthService,
		private viewService: ViewService,
		private likeService: LikeService,
	) {}

	public async getDoctorServiceTypes(doctorId: ObjectId): Promise<ServiceType[]> {
		const doctor = await this.doctorService.getDoctorByAdmin(doctorId);
		return serviceTypesForSpecialty(doctor.docSpecialty);
	}

	public async setDiscountByAdmin(id: string, percent: number): Promise<Service> {
		if (!Number.isFinite(percent) || percent < 0 || percent > 100)
			throw new BadRequestException('Discount must be between 0 and 100');
		const result = await this.serviceModel
			.findOneAndUpdate(
				{ _id: id, serviceStatus: { $ne: ServiceStatus.DELETED } },
				{ $set: { serviceDiscountPercent: percent } },
				{ new: true, runValidators: true },
			)
			.exec();
		if (!result) throw new BadRequestException('Service is unavailable');
		return result;
	}

	public async createOptionByAdmin(input: ServiceOptionInput): Promise<Service> {
		const base = await this.serviceModel.findOne({ _id: shapeIntoMongoObjectId(input.baseServiceId), serviceStatus: { $ne: ServiceStatus.DELETED } }).lean().exec();
		if (!base) throw new BadRequestException('Base service is unavailable');
		const doctor = await this.doctorService.getDoctorByAdmin(base.memberId);
		if (doctor.memberStatus !== MemberStatus.ACTIVE || doctor.deletedAt) throw new BadRequestException('The assigned doctor is unavailable');
		const packageData = input.includedServiceIds ? await this.packageData(base, input) : undefined;
		// Reuse service creation, ownership, specialty, calendar, limit and counter rules.
		const created = await this.createService({
			memberId: base.memberId, departmentId: base.departmentId, serviceType: base.serviceType,
			serviceName: base.serviceName, serviceTitle: input.serviceTitle.trim(), servicePrice: input.servicePrice,
			serviceDuration: input.serviceDuration, serviceDesc: input.serviceDesc?.trim() || base.serviceDesc,
			serviceImages: base.serviceImages, serviceRoomName: base.serviceRoomName, serviceRoom: base.serviceRoom,
			availabilityDates: base.availabilityDates, openedAt: base.openedAt, closedAt: base.closedAt,
			serviceStatus: ServiceStatus.INACTIVE,
		});
		if (!packageData) return created;
		return this.serviceModel
			.findOneAndUpdate({ _id: created._id }, { $set: packageData }, { new: true, runValidators: true })
			.exec();
	}

	private async packageData(base: Service, input: ServiceOptionInput, optionId?: ObjectId) {
		if (base.packageBaseServiceId || base.serviceStatus !== ServiceStatus.ACTIVE)
			throw new BadRequestException('Choose an active standard service as the package base');
		const ids = input.includedServiceIds ?? [];
		if (
			!ids.length ||
			ids.length > 3 ||
			new Set(ids).size !== ids.length ||
			ids.includes(String(base._id)) ||
			(optionId && ids.includes(String(optionId)))
		)
			throw new BadRequestException('Choose distinct additional services, excluding the base and package itself');
		const extras = await this.serviceModel
			.find({
				_id: { $in: ids.map((id) => shapeIntoMongoObjectId(id)) },
				memberId: base.memberId,
				serviceStatus: ServiceStatus.ACTIVE,
				deletedAt: { $exists: false },
				packageBaseServiceId: { $exists: false },
			})
			.lean()
			.exec();
		if (extras.length !== ids.length || extras.some((row) => row.serviceRoom !== base.serviceRoom))
			throw new BadRequestException('Package services must be active, belong to the same doctor and use the same room');
		const ordered = [base, ...ids.map((id) => extras.find((row) => String(row._id) === id))];
		const packageItems = ordered.map((row) => ({
			serviceId: String(row._id),
			title: row.serviceTitle || row.serviceName,
			price: discountedServicePrice(row.servicePrice, row.serviceDiscountPercent, clinicCurrency()).total,
			duration: Number(row.serviceDuration),
		}));
		const duration = packageItems.reduce((total, item) => total + item.duration, 0);
		const packageRegularPrice = packageItems.reduce((total, item) => total + item.price, 0);
		if (!Number.isInteger(duration) || duration < 1 || duration > 1440 || Number(input.serviceDuration) < duration)
			throw new BadRequestException('Package duration must cover all included services');
		if (!Number.isFinite(input.servicePrice) || input.servicePrice >= packageRegularPrice)
			throw new BadRequestException('Package total must be lower than buying its services separately');
		return { packageBaseServiceId: base._id, packageRegularPrice, packageItems };
	}
	public async updateOptionByAdmin(input: ServiceOptionUpdateInput): Promise<Service> {
		const option = await this.serviceModel.findOne({ _id: shapeIntoMongoObjectId(input.optionId), serviceStatus: { $ne: ServiceStatus.DELETED } })
			.lean()
			.exec();
		const base = await this.serviceModel.findOne({ _id: shapeIntoMongoObjectId(input.baseServiceId), serviceStatus: { $ne: ServiceStatus.DELETED } }).lean().exec();
		if (
			!option ||
			!base ||
			String(option._id) === String(base._id) ||
			String(option.memberId) !== String(base.memberId) ||
			String(option.departmentId) !== String(base.departmentId) ||
			option.serviceType !== base.serviceType
		)
			throw new BadRequestException('Choose a package belonging to this base service');
		const doctor = await this.doctorService.getDoctorByAdmin(base.memberId);
		if (doctor.memberStatus !== MemberStatus.ACTIVE || doctor.deletedAt) throw new BadRequestException('The assigned doctor is unavailable');
		if (input.serviceStatus && ![ServiceStatus.ACTIVE, ServiceStatus.INACTIVE].includes(input.serviceStatus))
			throw new BadRequestException('Package publishing supports active or inactive status');
		const data = await this.packageData(base, input, option._id);
		return this.serviceModel
			.findOneAndUpdate(
				{ _id: option._id, serviceStatus: { $ne: ServiceStatus.DELETED } },
				{
					$set: {
						...data,
						serviceTitle: input.serviceTitle.trim(),
						servicePrice: input.servicePrice,
						serviceDuration: input.serviceDuration,
						serviceDesc: input.serviceDesc,
						...(input.serviceStatus ? { serviceStatus: input.serviceStatus } : {}),
					},
				},
				{ new: true, runValidators: true },
			)
			.exec();
	}
	public async getBookingOptions(serviceId: ObjectId): Promise<Services> {
		const selected = await this.serviceModel.findOne({ _id: serviceId, serviceStatus: ServiceStatus.ACTIVE, deletedAt: { $exists: false } })
			.lean()
			.exec();
		if (!selected) throw new BadRequestException('Service is unavailable');
		const root = selected.packageBaseServiceId ?? selected._id;
		const result = await this.serviceModel
			.aggregate([
				{
					$match: {
						memberId: selected.memberId,
						serviceStatus: ServiceStatus.ACTIVE,
						deletedAt: { $exists: false },
						$or: [{ _id: root }, { packageBaseServiceId: root, 'packageItems.1': { $exists: true } }],
					},
				},
				lookupDoctor,
				{ $unwind: '$memberData' },
				{ $match: { 'memberData.memberStatus': MemberStatus.ACTIVE, 'memberData.deletedAt': { $exists: false } } },
				{ $sort: { createdAt: 1, _id: 1 } },
			])
			.exec();
		const base = result.find((row) => String(row._id) === String(root));
		if (!base) return { list: [], metaCounter: [] };
		const list = [base];
        for (const row of result.filter((item) => String(item._id) !== String(root))) {
            try {
                const data = await this.packageData(base, { includedServiceIds: row.packageItems.slice(1).map(item => item.serviceId), servicePrice: row.servicePrice, serviceDuration: row.serviceDuration } as ServiceOptionInput, row._id);
                list.push({ ...row, ...data });
            } catch (error) {
                if (!(error instanceof BadRequestException)) throw error;
                // Hide packages whose component services changed or became unavailable.
            }
        }
		return { list, metaCounter: [{ total: list.length }] };
	}

	public async createService(input: ServiceInput): Promise<Service> {
		try {
			if (!input.memberId) {
				throw new BadRequestException('Doctor id is required');
			}
			if (input.serviceStatus === ServiceStatus.DELETED) {
				throw new BadRequestException('A new service cannot be created as deleted');
			}
			const doctor = await this.doctorService.getDoctorByAdmin(input.memberId);
			assertSpecialtyServiceType(doctor.docSpecialty, input.serviceType);

			const sameTypeServiceCount = await this.serviceModel
				.countDocuments({
					memberId: input.memberId,
					serviceType: input.serviceType,
					serviceStatus: { $ne: ServiceStatus.DELETED },
				})
				.exec();

			if (sameTypeServiceCount >= MAX_SERVICES_PER_TYPE) {
				throw new BadRequestException(Message.SERVICE_TYPE_LIMIT_REACHED);
			}

			validateServiceAvailability(input);
			const result = await this.serviceModel.create(input);
			try {
				await this.doctorService.doctorStatisticEditor({
					_id: input.memberId,
					targetKey: 'docServices',
					modifier: 1,
				});
			} catch (err) {
				await this.serviceModel.deleteOne({ _id: result._id }).exec();
				throw err;
			}
			return result;
		} catch (err) {
			console.error('Error, ServiceService.createService:', err);
			if (err instanceof HttpException) throw err;
			throw new BadRequestException(Message.CREATE_FAILED);
		}
	}

	public async likeTargetService(memberId: ObjectId, serviceId: ObjectId): Promise<Service> {
		const targetService = await this.serviceModel
			.findOne({ _id: serviceId, serviceStatus: ServiceStatus.ACTIVE })
			.exec();
		if (!targetService) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const likeInput: LikeInput = {
			memberId,
			likeRefId: serviceId,
			likeGroup: LikeGroup.SERVICE,
		};
		const modifier = await this.likeService.toggleLike(likeInput);
		const result = await this.serviceStatsEditor({
			_id: serviceId,
			targetKey: 'serviceLikes',
			modifier,
		});

		if (!result) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
		result.meLiked = await this.likeService.checkLikeExistence(likeInput);
		return result;
	}

	public async getService(memberId: ObjectId, serviceId: ObjectId): Promise<Service> {
		const search: T = {
			_id: serviceId,
			serviceStatus: ServiceStatus.ACTIVE,
		};

		const targetService: Service = await this.serviceModel.findOne(search).lean().exec();
		if (!targetService) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		if (memberId) {
			const viewInput = { memberId: memberId, viewRefId: serviceId, viewGroup: ViewGroup.SERVICE };
			const newView = await this.viewService.recordView(viewInput);
			if (newView) {
				const viewed = await this.serviceStatsEditor({ _id: serviceId, targetKey: 'serviceViews', modifier: 1 });
				targetService.serviceViews = viewed.serviceViews;
			}

			const likeInput: LikeInput = {
				memberId,
				likeRefId: serviceId,
				likeGroup: LikeGroup.SERVICE,
			};
			targetService.meLiked = await this.likeService.checkLikeExistence(likeInput);
		}

		targetService.memberData =
			(await this.doctorService.findPublicDoctor(targetService.memberId, memberId)) ?? undefined;
		return targetService;
	}

	public async getRecommendedServices(serviceId: ObjectId, limit = 6): Promise<Services> {
		const currentService = await this.serviceModel
			.findOne({ _id: serviceId, serviceStatus: ServiceStatus.ACTIVE })
			.select('_id departmentId serviceType')
			.lean()
			.exec();
		if (!currentService) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const safeLimit = Math.min(Math.max(limit, 1), 20);
		const result = await this.serviceModel
			.aggregate([
				{
					$match: {
						_id: { $ne: currentService._id },
						serviceStatus: ServiceStatus.ACTIVE,
					},
				},
				{
					$addFields: {
						recommendationScore: {
							$add: [
								{ $cond: [{ $eq: ['$departmentId', currentService.departmentId] }, 3, 0] },
								{ $cond: [{ $eq: ['$serviceType', currentService.serviceType] }, 2, 0] },
							],
						},
					},
				},
				{
					$sort: {
						recommendationScore: -1,
						serviceRank: -1,
						serviceLikes: -1,
						serviceViews: -1,
						createdAt: -1,
					},
				},
				{ $limit: safeLimit },
				lookupDoctor,
				{ $unwind: { path: '$memberData', preserveNullAndEmptyArrays: true } },
				{ $project: { recommendationScore: 0 } },
			])
			.exec();

		return { list: result, metaCounter: [{ total: result.length }] };
	}

	public async getFavorites(memberId: ObjectId, input: OrdinaryInquiry): Promise<Services> {
		return await this.likeService.getFavoriteServices(memberId, input);
	}

	public async getVisited(memberId: ObjectId, input: OrdinaryInquiry): Promise<Services> {
		return await this.viewService.getVisitedServices(memberId, input);
	}

	public async serviceStatsEditor(input: StatisticModifier): Promise<Service> {
		const { _id, targetKey, modifier } = input;
		return await this.serviceModel.findByIdAndUpdate(_id, { $inc: { [targetKey]: modifier } }, { new: true }).exec();
	}

	public async updateService(memberId: ObjectId, input: ServiceUpdate): Promise<Service> {
		let { serviceStatus, inactiveAt, unavailabeAt } = input;
		let deletedAt: Date | undefined;
		const search: T = {
			_id: input._id,
			memberId,
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
			availabilityDates:
				input.availabilityDates !== undefined ? input.availabilityDates : currentService.availabilityDates,
			openedAt: input.openedAt ?? currentService.openedAt,
			closedAt: input.closedAt ?? currentService.closedAt,
		});
		if (input.serviceType !== undefined || input.serviceStatus === ServiceStatus.ACTIVE) {
			const doctor = await this.doctorService.getDoctorByAdmin(currentService.memberId);
			assertSpecialtyServiceType(doctor.docSpecialty, input.serviceType ?? currentService.serviceType);
		}

		if (input.serviceType && input.serviceType !== currentService.serviceType) {
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
		else if (serviceStatus === ServiceStatus.INACTIVE) inactiveAt = moment().toDate();
		else if (serviceStatus === ServiceStatus.UNAVAILABLE) unavailabeAt = moment().toDate();

		const updateData: T = { ...input };
		delete updateData._id;
		if (deletedAt) updateData.deletedAt = deletedAt;
		else if (inactiveAt) updateData.inactiveAt = inactiveAt;
		else if (unavailabeAt) updateData.unavailabeAt = unavailabeAt;

		const result = await this.serviceModel
			.findOneAndUpdate(search, { $set: updateData }, { new: true, runValidators: true })
			.exec();
		if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);

		if (serviceStatus === ServiceStatus.DELETED) {
			await this.doctorService.doctorStatisticEditor({
				_id: currentService.memberId,
				targetKey: 'docServices',
				modifier: -1,
			});
		}

		return result;
	}

	public async getServices(memberId: ObjectId, input: ServicesInquiry): Promise<Services> {
		const match: T = { serviceStatus: ServiceStatus.ACTIVE };
		const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };

		this.shapeMatchQuery(match, input);
		match.serviceStatus = ServiceStatus.ACTIVE;

		const result = await this.serviceModel
			.aggregate([
				{ $match: match },
				{ $sort: { ...sort, _id: 1 } },
				...(input.search.discountedOnly
					? [
							lookupDoctor,
							{ $unwind: '$memberData' },
							{ $match: { 'memberData.memberStatus': 'ACTIVE', 'memberData.deletedAt': { $exists: false } } },
						]
					: []),
				{
					$facet: {
						list: [
							{ $skip: (input.page - 1) * input.limit },
							{ $limit: input.limit },
							...(memberId ? [lookupAuthMemberLiked(memberId, '$_id', LikeGroup.SERVICE)] : []),
							...(input.search.discountedOnly ? [] : [lookupDoctor, { $unwind: '$memberData' }]),
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		return result[0];
	}

	private shapeMatchQuery(match: T, input: ServicesInquiry): void {
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
			discountedOnly,
		} = input.search;
		if (discountedOnly) match.serviceDiscountPercent = { $gt: 0, $lte: 100 };

		if (memberId) match.memberId = shapeIntoMongoObjectId(memberId);

		if (departmentId) {
			match.departmentId = shapeIntoMongoObjectId(departmentId);
		}

		if (serviceTypeList && serviceTypeList.length) {
			match.serviceType = { $in: serviceTypeList };
		}

		if (serviceStatusList && serviceStatusList.length) {
			match.serviceStatus = { $in: serviceStatusList };
		}

		if (serviceRoomNameList && serviceRoomNameList.length) {
			match.serviceRoomName = { $in: serviceRoomNameList };
		}

		if (serviceRoomList && serviceRoomList.length) {
			match.serviceRoom = { $in: serviceRoomList };
		}

		if (priceRange) {
			match.servicePrice = {
				$gte: priceRange.start,
				$lte: priceRange.end,
			};
		}

		if (periodsRange) {
			match.createdAt = {
				$gte: periodsRange.start,
				$lte: periodsRange.end,
			};
		}

		if (text) {
			const searchRegex = new RegExp(text.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

			match.$or = [{ serviceName: searchRegex }, { serviceTitle: searchRegex }, { serviceDesc: searchRegex }];
		}
	}

	public async getDoctorServices(memberId: ObjectId, input: DoctorServicesInquiry): Promise<Services> {
		const serviceStatus = input.search?.serviceStatus;
		if ([ServiceStatus.DELETED, ServiceStatus.INACTIVE, ServiceStatus.UNAVAILABLE].includes(serviceStatus))
			throw new BadRequestException(Message.NOT_ALLOWED_REQUEST);

		const match: T = {
			memberId: memberId,
			serviceStatus: serviceStatus ?? { $ne: ServiceStatus.DELETED },
		};
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
							lookupAuthMemberLiked(memberId, '$_id', LikeGroup.SERVICE),
							lookupDoctor,
							{ $unwind: '$memberData' },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		return result[0];
	}
}

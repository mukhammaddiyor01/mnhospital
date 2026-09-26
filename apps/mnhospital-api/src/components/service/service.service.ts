import { BadRequestException, HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AuthService } from '../auth/auth.service';
import { ViewService } from '../view/view.service';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Service, Services } from './dto/service';
import { MemberService } from '../member/member.service';
import { DoctorServicesInquiry, ServiceInput, ServicesInquiry } from './dto/service.input';
import { Direction, Message } from '../../libs/enums/common.enum';
import { StatisticModifier, T } from '../../libs/types/common';
import { MAX_SERVICES_PER_TYPE, ServiceStatus } from './enums/service.enum';
import { ViewGroup } from '../view/enums/view.enum';
import { ServiceUpdate } from './dto/service.update';
import { DoctorService } from '../doctor/doctor.service';
import moment = require('moment');
import { lookupDoctor, shapeIntoMongoObjectId } from '../../libs/config';
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

	public async createService(input: ServiceInput): Promise<Service> {
		try {
			if (!input.memberId) {
				throw new BadRequestException('Doctor id is required');
			}
			if (input.serviceStatus === ServiceStatus.DELETED) {
				throw new BadRequestException('A new service cannot be created as deleted');
			}

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
				await this.serviceStatsEditor({ _id: serviceId, targetKey: 'serviceViews', modifier: 1 });
				targetService.serviceViews++;
			}

			const likeInput: LikeInput = {
				memberId,
				likeRefId: serviceId,
				likeGroup: LikeGroup.SERVICE,
			};
			targetService.meLiked = await this.likeService.checkLikeExistence(likeInput);
		}

		targetService.memberData = await this.doctorService.getDoctor(targetService.memberId, memberId);
		return targetService;
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
			serviceStatus: ServiceStatus.ACTIVE,
		};

		const currentService = await this.serviceModel.findOne(search).exec();
		if (!currentService) throw new InternalServerErrorException(Message.UPDATE_FAILED);

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
				{ $sort: sort },
				{
					$facet: {
						list: [
							{ $skip: (input.page - 1) * input.limit },
							{ $limit: input.limit },
							lookupDoctor,
							{ $unwind: '$memberData' },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		if (memberId && result[0].list?.length) {
			result[0].list = await Promise.all(
				result[0].list.map(async (service: Service) => {
					service.meLiked = await this.likeService.checkLikeExistence({
						memberId,
						likeRefId: service._id,
						likeGroup: LikeGroup.SERVICE,
					});
					return service;
				}),
			);
		}

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
		} = input.search;

		if (memberId) match.memberId = shapeIntoMongoObjectId(memberId);

		if (departmentId) {
			match.departmentId = shapeIntoMongoObjectId(departmentId);
		}

		if (serviceTypeList) {
			match.serviceType = { $in: serviceTypeList };
		}

		if (serviceStatusList) {
			match.serviceStatus = { $in: serviceStatusList };
		}

		if (serviceRoomNameList) {
			match.serviceRoomName = { $in: serviceRoomNameList };
		}

		if (serviceRoomList) {
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
			const searchRegex = new RegExp(text, 'i');

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
							lookupDoctor,
							{ $unwind: '$memberData' },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		if (memberId && result[0].list?.length) {
			result[0].list = await Promise.all(
				result[0].list.map(async (service: Service) => {
					service.meLiked = await this.likeService.checkLikeExistence({
						memberId,
						likeRefId: service._id,
						likeGroup: LikeGroup.SERVICE,
					});
					return service;
				}),
			);
		}

		return result[0];
	}
}

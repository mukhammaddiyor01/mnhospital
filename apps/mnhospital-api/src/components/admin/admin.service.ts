import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import moment = require('moment');
import { Member, Members } from '../member/dto/member';
import { MembersInquiry } from '../member/dto/member.input';
import { Service, Services } from '../service/dto/service';
import { ServiceSearch, ServicesInquiry } from '../service/dto/service.input';
import { ServiceUpdate } from '../service/dto/service.update';
import { ServiceStatus, MAX_SERVICES_PER_TYPE } from '../service/enums/service.enum';
import { DoctorService } from '../doctor/doctor.service';
import { Direction, Message } from '../../libs/enums/common.enum';
import { lookupDoctor, shapeIntoMongoObjectId } from '../../libs/config';
import { T } from '../../libs/types/common';
import { MemberUpdate } from '../member/dto/member.update';

@Injectable()
export class AdminService {
	constructor(
		@InjectModel('Member') private readonly memberModel: Model<Member>,
		@InjectModel('Service') private readonly serviceModel: Model<Service>,
		private readonly doctorService: DoctorService,
	) {}

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
		const result: Member = await this.memberModel.findOneAndUpdate({ _id: input._id }, input, { new: true }).exec();
		if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);

		return result;
	}

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

		if (serviceStatus !== ServiceStatus.DELETED && input.serviceType && input.serviceType !== currentService.serviceType) {
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
}

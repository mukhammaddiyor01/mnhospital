import { BadRequestException, HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AuthService } from '../auth/auth.service';
import { ViewService } from '../view/view.service';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Service } from './dto/service';
import { MemberService } from '../member/member.service';
import { ServiceInput } from './dto/service.input';
import { Message } from '../../libs/enums/common.enum';
import { StatisticModifier, T } from '../../libs/types/common';
import { MAX_SERVICES_PER_TYPE, ServiceStatus } from './enums/service.enum';
import { ViewGroup } from '../view/enums/view.enum';

@Injectable()
export class ServiceService {
	constructor(
		@InjectModel('Service') private readonly serviceModel: Model<Service>,
		private memberService: MemberService,
		private authService: AuthService,
		private viewService: ViewService,
	) {}

	public async createService(input: ServiceInput): Promise<Service> {
		try {
			if (!input.memberId) {
				throw new BadRequestException('Doctor id is required');
			}

			const sameTypeServiceCount = await this.serviceModel
				.countDocuments({
					memberId: input.memberId,
					serviceType: input.serviceType,
				})
				.exec();

			if (sameTypeServiceCount >= MAX_SERVICES_PER_TYPE) {
				throw new BadRequestException(Message.SERVICE_TYPE_LIMIT_REACHED);
			}

			const result = await this.serviceModel.create(input);
			return result;
		} catch (err) {
			console.error('Error, ServiceService.createService:', err);
			if (err instanceof HttpException) throw err;
			throw new BadRequestException(Message.CREATE_FAILED);
		}
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

			//meLiked
		}

		targetService.memberData = await this.memberService.getMember(null, targetService.memberId);
		return targetService;
	}

	public async serviceStatsEditor(input: StatisticModifier): Promise<Service> {
		const { _id, targetKey, modifier } = input;
		return await this.serviceModel.findByIdAndUpdate(_id, { $inc: { [targetKey]: modifier } }, { new: true }).exec();
	}
}

import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AuthService } from '../auth/auth.service';
import { ViewService } from '../view/view.service';
import { Model } from 'mongoose';
import { Service } from './dto/service';
import { MemberService } from '../member/member.service';
import { ServiceInput } from './dto/service.input';
import { Message } from '../../libs/enums/common.enum';

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

			const result = await this.serviceModel.create(input);
			return result;
		} catch (err) {
			console.error('Error, ServiceService.createService:', err);
			if (err instanceof HttpException) throw err;
			throw new BadRequestException(Message.CREATE_FAILED);
		}
	}
}

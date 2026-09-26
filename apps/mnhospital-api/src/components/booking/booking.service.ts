import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Message } from '../../libs/enums/common.enum';
import { PatientService } from '../patient/patient.service';
import { Cart } from './dto/cart';
import { CartStatus } from '../patient/enums/patient.enum';
import { CartInput } from './dto/cart.input';

@Injectable()
export class BookingService {
	constructor(
		@InjectModel('Cart') private readonly cartModel: Model<Cart>,
		private readonly patientService: PatientService,
	) {}

	public async createCart(memberId: ObjectId, input: CartInput): Promise<Cart> {
		const patientId = await this.patientService.resolveProfileId(memberId);
		const existingCart = await this.cartModel.findOne({ patientId, cartStatus: CartStatus.ACTIVE }).exec();
		if (existingCart) return existingCart;

		return await this.cartModel.create({
			patientId,
			currency: input.currency ?? 'UZS',
			cartStatus: CartStatus.ACTIVE,
			subtotalAmount: 0,
			discountAmount: 0,
			totalAmount: 0,
		});
	}

	public async getMyCart(memberId: ObjectId): Promise<Cart> {
		const patientId = await this.patientService.resolveProfileId(memberId);
		const cart = await this.cartModel.findOne({ patientId, cartStatus: CartStatus.ACTIVE }).exec();
		if (!cart) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		return cart;
	}
}

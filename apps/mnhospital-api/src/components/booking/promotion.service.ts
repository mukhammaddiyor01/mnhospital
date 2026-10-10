import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingPromoInput, PromoCode, PromoCodeInput, PromoCodesInquiry, PromoCodeUpdate } from './dto/promotion';
import { BookingOrder } from './dto/booking-order';
import { PatientService } from '../patient/patient.service';
import { Service } from '../service/dto/service';
import { clinicCurrency } from '../../libs/booking/clinic-time';
import { priceBookingLines } from './pricing.policy';

@Injectable()
export class PromotionService {
	constructor(
		@InjectModel('PromoCode') private readonly promos: Model<PromoCode>,
		@InjectModel('BookingOrder') private readonly orders: Model<BookingOrder>,
		@InjectModel('Service') private readonly services: Model<Service>,
		private readonly patients: PatientService,
	) {}
	async publicOffers() {
		const now = new Date();
		return this.promos.find({
			showOnHomepage: true,
			isActive: true,
			deletedAt: { $exists: false },
			currency: clinicCurrency(),
			$and: [
				{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
				{ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
			],
		}).select('_id code discountType discountValue currency minSubtotal serviceIds expiresAt')
			.sort({ updatedAt: -1, _id: -1 }).limit(3).lean().exec();
	}
	async list(input: PromoCodesInquiry) {
		const filter = { deletedAt: { $exists: false } };
		const [list, total] = await Promise.all([
			this.promos
				.find(filter)
				.sort({ createdAt: -1 })
				.skip((input.page - 1) * input.limit)
				.limit(input.limit)
				.exec(),
			this.promos.countDocuments(filter).exec(),
		]);
		return { list, metaCounter: [{ total }] };
	}
	private async validate(input: PromoCodeInput) {
		if (input.discountType === 'PERCENT' && input.discountValue > 100)
			throw new BadRequestException('Percentage cannot exceed 100');
		if (input.startsAt && input.expiresAt && new Date(input.expiresAt) <= new Date(input.startsAt))
			throw new BadRequestException('Promo expiry must follow its start');
		if (
			input.serviceIds?.length &&
			(await this.services
				.countDocuments({ _id: { $in: input.serviceIds }, serviceStatus: { $ne: 'DELETED' } })
				.exec()) !== input.serviceIds.length
		)
			throw new BadRequestException('Choose existing services for this promo code');
	}
	async create(actor: Types.ObjectId, input: PromoCodeInput) {
		await this.validate(input);
		try {
			return await this.promos.create({
				...input,
				code: input.code.trim().toUpperCase(),
				currency: clinicCurrency(),
				createdBy: actor,
				updatedBy: actor,
			});
		} catch (error) {
			if (error?.code === 11000) throw new BadRequestException('Promo code already exists, including archived codes');
			throw error;
		}
	}
	async update(actor: Types.ObjectId, input: PromoCodeUpdate) {
		await this.validate(input);
		const { _id, ...fields } = input;
		try {
			const result = await this.promos
				.findOneAndUpdate(
					{ _id, deletedAt: { $exists: false } },
					{ $set: { ...fields, code: input.code.trim().toUpperCase(), updatedBy: actor } },
					{ new: true, runValidators: true },
				)
				.exec();
			if (!result) throw new NotFoundException('Promo code is unavailable');
			return result;
		} catch (error) {
			if (error?.code === 11000) throw new BadRequestException('Promo code already exists, including archived codes');
			throw error;
		}
	}
	async remove(actor: Types.ObjectId, id: string) {
		const result = await this.promos
			.findOneAndUpdate(
				{ _id: id, deletedAt: { $exists: false } },
				{ $set: { isActive: false, deletedAt: new Date(), updatedBy: actor } },
				{ new: true },
			)
			.exec();
		if (!result) throw new NotFoundException('Promo code is unavailable');
		return result;
	}
	private assertActive(promo: PromoCode, currency: string) {
		const now = Date.now();
		if (
			!promo ||
			promo.deletedAt ||
			!promo.isActive ||
			promo.currency !== currency ||
			(promo.startsAt && new Date(promo.startsAt).getTime() > now) ||
			(promo.expiresAt && new Date(promo.expiresAt).getTime() <= now)
		)
			throw new BadRequestException('Promo code is inactive, expired or unavailable for this currency');
	}
	async assertAvailable(order: BookingOrder) {
		if (order.promoCodeId)
			this.assertActive(await this.promos.findById(order.promoCodeId).lean().exec(), order.bookingOrderCurrency);
	}
	async apply(memberId: Types.ObjectId, input: BookingPromoInput) {
		const patientId = await this.patients.resolveProfileId(memberId);
		const filter = {
			_id: input.bookingOrderId,
			patientId,
			bookingOrderStatus: 'PENDING',
			pricingVersion: 1,
			pricingLockedAt: { $exists: false },
		};
		const order = await this.orders.findOne(filter).lean().exec();
		if (!order)
			throw new BadRequestException('Promo codes can only change on your unpaid booking before payment starts');
		let promo: PromoCode;
		if (input.promoCode) {
			promo = await this.promos.findOne({ code: input.promoCode.trim().toUpperCase() }).lean().exec();
			this.assertActive(promo, order.bookingOrderCurrency);
		}
		const price = priceBookingLines(order.bookingOrderItems, order.bookingOrderCurrency, promo);
		if (promo && price.eligibleSubtotal < promo.minSubtotal)
			throw new BadRequestException('Booking does not meet the promo minimum amount');
		const result = await this.orders
			.findOneAndUpdate(
				{ ...filter, pricingRevision: order.pricingRevision ?? 0 },
				{
					$set: {
						bookingOrderItems: price.items,
						bookingOrderSubtotalAmount: price.subtotal,
						bookingOrderDiscountAmount: price.discount,
						bookingOrderTotalAmount: price.total,
						serviceDiscountAmount: price.serviceDiscount,
						promoDiscountAmount: price.promoDiscount,
						promoCode: promo?.code ?? null,
						promoCodeId: promo?._id ?? null,
					},
					$inc: { pricingRevision: 1 },
				},
				{ new: true, runValidators: true },
			)
			.exec();
		if (!result) throw new BadRequestException('Booking changed. Refresh before updating your promo code');
		return result;
	}
}

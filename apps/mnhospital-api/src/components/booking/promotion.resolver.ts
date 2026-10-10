import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { MemberType } from '../member/enums/member.enum';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { PromotionService } from './promotion.service';
import { BookingOrder } from './dto/booking-order';
import {
	PublicPromoOffer,
	BookingPromoInput,
	PromoCode,
	PromoCodeInput,
	PromoCodes,
	PromoCodesInquiry,
	PromoCodeUpdate,
} from './dto/promotion';

@Resolver()
export class PromotionResolver {
	constructor(private readonly promotions: PromotionService) {}
	@Query(() => [PublicPromoOffer])
	getPublicPromoOffers() {
		return this.promotions.publicOffers();
	}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => PromoCodes)
	getPromoCodesByAdmin(@Args('input') input: PromoCodesInquiry) {
		return this.promotions.list(input);
	}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => PromoCode)
	createPromoCodeByAdmin(@Args('input') input: PromoCodeInput, @AuthMember('_id') id: Types.ObjectId) {
		return this.promotions.create(id, input);
	}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => PromoCode)
	updatePromoCodeByAdmin(@Args('input') input: PromoCodeUpdate, @AuthMember('_id') id: Types.ObjectId) {
		return this.promotions.update(id, input);
	}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => PromoCode)
	removePromoCodeByAdmin(@Args('promoCodeId') id: string, @AuthMember('_id') actor: Types.ObjectId) {
		return this.promotions.remove(actor, String(shapeIntoMongoObjectId(id)));
	}
	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Mutation(() => BookingOrder)
	applyBookingPromoCode(@Args('input') input: BookingPromoInput, @AuthMember('_id') id: Types.ObjectId) {
		return this.promotions.apply(id, input);
	}
}

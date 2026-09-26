import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { WithoutGuard } from '../auth/guards/without.guard';
import { MemberType } from '../member/enums/member.enum';
import { Advertisement, Advertisements } from './dto/advertisement';
import { AdvertisementInput, AdvertisementsInquiry } from './dto/advertisement.input';
import { AdvertisementUpdate } from './dto/advertisement.update';
import { AdvertisementService } from './advertisement.service';

@Resolver()
export class AdvertisementResolver {
	constructor(private readonly advertisementService: AdvertisementService) {}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Advertisement)
	public async createAdvertisement(
		@Args('input') input: AdvertisementInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Advertisement> {
		console.log('Mutation: createAdvertisement');
		return await this.advertisementService.createAdvertisement(memberId, input);
	}

	@UseGuards(WithoutGuard)
	@Query(() => Advertisements)
	public async getAdvertisements(@Args('input') input: AdvertisementsInquiry): Promise<Advertisements> {
		console.log('Query: getAdvertisements');
		return await this.advertisementService.getAdvertisements(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Advertisement)
	public async updateAdvertisement(@Args('input') input: AdvertisementUpdate): Promise<Advertisement> {
		console.log('Mutation: updateAdvertisement');
		return await this.advertisementService.updateAdvertisement(input);
	}
}

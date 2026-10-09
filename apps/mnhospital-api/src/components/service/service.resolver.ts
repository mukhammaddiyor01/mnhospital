import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ServiceService } from './service.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { MemberType } from '../member/enums/member.enum';
import { UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Service, Services } from './dto/service';
import { DoctorServicesInquiry, OrdinaryInquiry, ServiceInput, ServicesInquiry } from './dto/service.input';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { WithoutGuard } from '../auth/guards/without.guard';
import { AuthGuard } from '../auth/guards/auth.guard';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { ServiceUpdate } from './dto/service.update';
import { ServiceDiscountInput } from './dto/service.discount.input';
import { ServiceType } from './enums/service.enum';

@Resolver()
export class ServiceResolver {
	constructor(private readonly serviceService: ServiceService) {}

	@Roles(MemberType.ADMIN) @UseGuards(RolesGuard) @Mutation(() => Service)
	setServiceDiscountByAdmin(@Args('input') input: ServiceDiscountInput) {
		return this.serviceService.setDiscountByAdmin(input.serviceId, input.discountPercent);
	}

	@Roles(MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Query(() => [ServiceType])
	public async getMyDoctorServiceTypes(@AuthMember('_id') doctorId: ObjectId): Promise<ServiceType[]> {
		return this.serviceService.getDoctorServiceTypes(doctorId);
	}

	@Roles(MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Mutation(() => Service)
	public async createService(
		@Args('input') input: ServiceInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Service> {
		console.log('Mutation: createService');
		input.memberId = memberId;

		return await this.serviceService.createService(input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Service)
	public async likeTargetService(
		@Args('serviceId') input: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Service> {
		console.log('Mutation: likeTargetService');
		return await this.serviceService.likeTargetService(memberId, shapeIntoMongoObjectId(input));
	}

	@UseGuards(WithoutGuard)
	@Query(() => Service)
	public async getService(@Args('serviceId') input: string, @AuthMember('_id') memberId: ObjectId): Promise<Service> {
		console.log('Query: getService');
		const serviceId = shapeIntoMongoObjectId(input);
		return await this.serviceService.getService(memberId, serviceId);
	}

	@UseGuards(WithoutGuard)
	@Query(() => Services)
	public async getRecommendedServices(
		@Args('serviceId') serviceId: string,
		@Args('limit', { type: () => Int, defaultValue: 6 }) limit: number,
	): Promise<Services> {
		console.log('Query: getRecommendedServices');
		return this.serviceService.getRecommendedServices(shapeIntoMongoObjectId(serviceId), limit);
	}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Query(() => Services)
	public async getFavorites(
		@Args('input') input: OrdinaryInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Services> {
		console.log('Query: getFavorites');
		return await this.serviceService.getFavorites(memberId, input);
	}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Query(() => Services)
	public async getVisited(
		@Args('input') input: OrdinaryInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Services> {
		console.log('Query: getVisited');
		return await this.serviceService.getVisited(memberId, input);
	}

	@Roles(MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Mutation((returns) => Service)
	public async updateService(
		@Args('input') input: ServiceUpdate,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Service> {
		console.log('Mutation: updateService');
		input._id = shapeIntoMongoObjectId(input._id);
		return await this.serviceService.updateService(memberId, input);
	}

	@UseGuards(WithoutGuard)
	@Query((returns) => Services)
	public async getServices(
		@Args('input') input: ServicesInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Services> {
		console.log('Query: getServices');
		return await this.serviceService.getServices(memberId, input);
	}

	@Roles(MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Query((returns) => Services)
	public async getDoctorServices(
		@Args('input') input: DoctorServicesInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Services> {
		console.log('Query, getDoctorServices');
		return await this.serviceService.getDoctorServices(memberId, input);
	}
}

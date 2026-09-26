import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ServiceService } from './service.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { MemberType } from '../member/enums/member.enum';
import { UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Service, Services } from './dto/service';
import { DoctorServicesInquiry, ServiceInput, ServicesInquiry } from './dto/service.input';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { WithoutGuard } from '../auth/guards/without.guard';
import { AuthGuard } from '../auth/guards/auth.guard';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { ServiceUpdate } from './dto/service.update';

@Resolver()
export class ServiceResolver {
	constructor(private readonly serviceService: ServiceService) {}

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

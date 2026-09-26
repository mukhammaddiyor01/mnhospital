import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ServiceService } from './service.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { MemberType } from '../member/enums/member.enum';
import { UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Service } from './dto/service';
import { ServiceInput } from './dto/service.input';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { WithoutGuard } from '../auth/guards/without.guard';
import { shapeIntoMongoObjectId } from '../../libs/config';

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

	@UseGuards(WithoutGuard)
	@Query(() => Service)
	public async getService(@Args('serviceId') input: string, @AuthMember('_id') memberId: ObjectId): Promise<Service> {
		console.log('Query: getService');
		const serviceId = shapeIntoMongoObjectId(input);
		return await this.serviceService.getService(memberId, serviceId);
	}
}

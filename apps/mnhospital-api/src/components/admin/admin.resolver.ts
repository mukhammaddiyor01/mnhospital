import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType } from '../member/enums/member.enum';
import { AdminService } from './admin.service';
import { Member, Members } from '../member/dto/member';
import { MembersInquiry } from '../member/dto/member.input';
import { MemberUpdate } from '../member/dto/member.update';
import { Service, Services } from '../service/dto/service';
import { ServicesInquiry } from '../service/dto/service.input';
import { ServiceUpdate } from '../service/dto/service.update';
import { shapeIntoMongoObjectId } from '../../libs/config';

@Resolver()
export class AdminResolver {
	constructor(private readonly adminService: AdminService) {}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Members)
	public async getAllMembersByAdmin(@Args('input') input: MembersInquiry): Promise<Members> {
		console.log('Mutation: getAllMembersByAdmin');
		return this.adminService.getAllMembersByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Member)
	public async updateMemberByAdmin(@Args('input') input: MemberUpdate): Promise<Member> {
		console.log('Mutation: updateMemberByAdmin');
		return await this.adminService.updateMemberByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Services)
	public async getAllServicesByAdmin(@Args('input') input: ServicesInquiry): Promise<Services> {
		console.log('Mutation: getAllServicesByAdmin');
		return await this.adminService.getAllServicesByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Service)
	public async updateServiceByAdmin(@Args('input') input: ServiceUpdate): Promise<Service> {
		console.log('Mutation: updateServiceByAdmin');
		input._id = shapeIntoMongoObjectId(input._id);
		return await this.adminService.updateServiceByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Service)
	public async removeServiceByAdmin(@Args('serviceId') input: string): Promise<Service> {
		console.log('Mutation: removeServiceByAdmin');
		return await this.adminService.removeServiceByAdmin(shapeIntoMongoObjectId(input));
	}
}

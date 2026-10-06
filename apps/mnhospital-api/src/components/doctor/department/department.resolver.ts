import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { MemberType } from '../../member/enums/member.enum';
import { Department } from './dto/department';
import { DepartmentInput } from './dto/department.input';
import { DepartmentService } from './department.service';
import { WithoutGuard } from '../../auth/guards/without.guard';
import { Service } from '../../service/dto/service';
import { shapeIntoMongoObjectId } from '../../../libs/config';

@Resolver()
export class DepartmentResolver {
	constructor(private readonly departmentService: DepartmentService) {}

	@Roles(MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Mutation(() => Department)
	public async createDepartment(@Args('input') input: DepartmentInput): Promise<Department> {
		console.log('Mutation: createDepartment');
		return await this.departmentService.createDepartment(input);
	}
	@Roles(MemberType.DOCTOR, MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => [Department])
	public async getDepartments(): Promise<Department[]> {
		return this.departmentService.getDepartments();
	}

}

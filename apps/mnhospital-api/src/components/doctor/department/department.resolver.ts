import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { MemberType } from '../../member/enums/member.enum';
import { Department } from './dto/department';
import { DepartmentInput } from './dto/department.input';
import { DepartmentService } from './department.service';

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
}

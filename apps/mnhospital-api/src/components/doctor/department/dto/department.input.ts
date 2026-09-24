import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { DepartmentStatus } from '../enums/department.enum';

@InputType()
export class DepartmentInput {
	@IsString()
	@IsNotEmpty()
	@Length(2, 100)
	@Field(() => String)
	departmentName: string;

	@IsOptional()
	@IsEnum(DepartmentStatus)
	@Field(() => DepartmentStatus, { nullable: true })
	departmentStatus?: DepartmentStatus;

	@IsOptional()
	@IsString()
	@Length(2, 150)
	@Field(() => String, { nullable: true })
	departmentTitle?: string;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	departmentDesc?: string;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	departmentImage?: string;
}

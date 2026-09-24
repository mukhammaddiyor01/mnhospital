import { Field, ObjectType } from '@nestjs/graphql';
import { ObjectId } from 'mongoose';
import { DepartmentStatus } from '../enums/department.enum';

@ObjectType()
export class Department {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	departmentName: string;

	@Field(() => DepartmentStatus)
	departmentStatus: DepartmentStatus;

	@Field(() => String, { nullable: true })
	departmentTitle?: string;

	@Field(() => String, { nullable: true })
	departmentDesc?: string;

	@Field(() => String, { nullable: true })
	departmentImage?: string;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}

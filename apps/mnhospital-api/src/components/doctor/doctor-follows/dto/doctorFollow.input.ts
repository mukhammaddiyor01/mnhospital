import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsInstance, IsNotEmpty, IsOptional, Min } from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;

@InputType()
class DoctorFollowSearch {
	@IsOptional()
	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: 'doctorId must be a valid ObjectId' })
	@Field(() => String, { nullable: true })
	doctorId?: ObjectId;

	@IsOptional()
	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: 'memberId must be a valid ObjectId' })
	@Field(() => String, { nullable: true })
	memberId?: ObjectId;
}

@InputType()
export class DoctorFollowInquiry {
	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	limit: number;

	@IsNotEmpty()
	@Field(() => DoctorFollowSearch)
	search: DoctorFollowSearch;
}

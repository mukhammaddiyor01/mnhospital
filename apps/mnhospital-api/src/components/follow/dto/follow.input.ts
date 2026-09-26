import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsInstance, IsNotEmpty, IsOptional, Min } from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;

@InputType()
class FollowSearch {
	@IsOptional()
	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: 'followingId must be a valid ObjectId' })
	@Field(() => String, { nullable: true })
	followingId?: ObjectId;

	@IsOptional()
	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: 'followerId must be a valid ObjectId' })
	@Field(() => String, { nullable: true })
	followerId?: ObjectId;
}

@InputType()
export class FollowInquiry {
	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	limit: number;

	@IsNotEmpty()
	@Field(() => FollowSearch)
	search: FollowSearch;
}

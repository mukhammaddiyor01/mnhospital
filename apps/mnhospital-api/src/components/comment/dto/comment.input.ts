import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import {
	IsEnum,
	IsIn,
	IsInstance,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Length,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { availableCommentSorts } from '../../../libs/config';
import { Direction } from '../../../libs/enums/common.enum';
import { ReferenceGroup } from '../../../libs/enums/reference.enum';

@InputType()
export class CommentInput {
	@IsEnum(ReferenceGroup)
	@IsNotEmpty()
	@Field(() => ReferenceGroup)
	commentGroup: ReferenceGroup;

	@IsString()
	@IsNotEmpty()
	@Length(1, 100)
	@Field(() => String)
	commentContent: string;

	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: 'commentRefId must be a valid ObjectId' })
	@IsNotEmpty()
	@Field(() => String)
	commentRefId: ObjectId;

	memberId?: ObjectId;
}

@InputType()
export class CommentSearch {
	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: 'commentRefId must be a valid ObjectId' })
	@IsNotEmpty()
	@Field(() => String)
	commentRefId: ObjectId;
}

@InputType()
export class CommentsInquiry {
	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 1 })
	page: number = 1;

	@IsInt()
	@Min(1)
	@Max(100)
	@Field(() => Int, { defaultValue: 10 })
	limit: number = 10;

	@IsOptional()
	@IsIn(availableCommentSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@IsEnum(Direction)
	@Field(() => Direction, { nullable: true })
	direction?: Direction;

	@IsNotEmpty()
	@ValidateNested()
	@Type(() => CommentSearch)
	@Field(() => CommentSearch)
	search: CommentSearch;
}

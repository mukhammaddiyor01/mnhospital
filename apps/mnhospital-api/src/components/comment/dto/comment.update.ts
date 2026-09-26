import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEnum, IsInstance, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { CommentStatus } from '../enums/comment.enum';

@InputType()
export class CommentUpdate {
	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: '_id must be a valid ObjectId' })
	@IsNotEmpty()
	@Field(() => String)
	_id: ObjectId;

	@IsOptional()
	@IsEnum(CommentStatus)
	@Field(() => CommentStatus, { nullable: true })
	commentStatus?: CommentStatus;

	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@Length(1, 100)
	@Field(() => String, { nullable: true })
	commentContent?: string;
}

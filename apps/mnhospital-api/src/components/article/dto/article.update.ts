import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsInstance, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Transform } from 'class-transformer';
import { ArticleCategory, ArticleStatus } from '../enums/article.enum';

@InputType()
export class ArticleUpdate {
	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: '_id must be a valid ObjectId' })
	@IsNotEmpty()
	@Field(() => String)
	_id: ObjectId;

	@IsOptional()
	@IsEnum(ArticleCategory)
	@Field(() => ArticleCategory, { nullable: true })
	articleCategory?: ArticleCategory;

	@IsOptional()
	@IsEnum(ArticleStatus)
	@Field(() => ArticleStatus, { nullable: true })
	articleStatus?: ArticleStatus;

	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@Length(2, 150)
	@Field(() => String, { nullable: true })
	articleTitle?: string;

	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@Length(1, 10000)
	@Field(() => String, { nullable: true })
	articleContent?: string;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	articleImage?: string;
}

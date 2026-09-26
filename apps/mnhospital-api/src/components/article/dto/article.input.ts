import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import {
	IsArray,
	IsDate,
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
import { availableArticleSorts } from '../../../libs/config';
import { Direction } from '../../../libs/enums/common.enum';
import { ArticleCategory, ArticleStatus } from '../enums/article.enum';

@InputType()
export class ArticleInput {
	@IsEnum(ArticleCategory)
	@IsNotEmpty()
	@Field(() => ArticleCategory)
	articleCategory: ArticleCategory;

	@IsString()
	@IsNotEmpty()
	@Length(2, 150)
	@Field(() => String)
	articleTitle: string;

	@IsString()
	@IsNotEmpty()
	@Length(1, 10000)
	@Field(() => String)
	articleContent: string;

	@IsOptional()
	@IsEnum(ArticleStatus)
	@Field(() => ArticleStatus, { nullable: true })
	articleStatus?: ArticleStatus;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	articleImage?: string;
}

@InputType()
export class ArticlePeriodsRange {
	@Type(() => Date)
	@IsDate()
	@Field(() => Date)
	start: Date;

	@Type(() => Date)
	@IsDate()
	@Field(() => Date)
	end: Date;
}

@InputType()
export class ArticleSearch {
	@IsOptional()
	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: 'memberId must be a valid ObjectId' })
	@Field(() => String, { nullable: true })
	memberId?: ObjectId;

	@IsOptional()
	@IsArray()
	@IsEnum(ArticleCategory, { each: true })
	@Field(() => [ArticleCategory], { nullable: true })
	articleCategoryList?: ArticleCategory[];

	@IsOptional()
	@IsEnum(ArticleStatus)
	@Field(() => ArticleStatus, { nullable: true })
	articleStatus?: ArticleStatus;

	@IsOptional()
	@ValidateNested()
	@Type(() => ArticlePeriodsRange)
	@Field(() => ArticlePeriodsRange, { nullable: true })
	periodsRange?: ArticlePeriodsRange;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	text?: string;
}

@InputType()
export class ArticlesInquiry {
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
	@IsIn(availableArticleSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@IsEnum(Direction)
	@Field(() => Direction, { nullable: true })
	direction?: Direction;

	@IsNotEmpty()
	@ValidateNested()
	@Type(() => ArticleSearch)
	@Field(() => ArticleSearch)
	search: ArticleSearch;
}

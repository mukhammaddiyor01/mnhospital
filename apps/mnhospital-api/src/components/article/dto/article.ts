import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Member } from '../../member/dto/member';
import { ArticleCategory, ArticleStatus } from '../enums/article.enum';

@ObjectType()
export class Article {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	memberId: ObjectId;

	@Field(() => ArticleCategory)
	articleCategory: ArticleCategory;

	@Field(() => ArticleStatus)
	articleStatus: ArticleStatus;

	@Field(() => String)
	articleTitle: string;

	@Field(() => String)
	articleContent: string;

	@Field(() => String, { nullable: true })
	articleImage?: string;

	@Field(() => Int)
	articleLikes: number;

	@Field(() => Int)
	articleViews: number;

	@Field(() => Int)
	articleComments: number;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;

	@Field(() => Member, { nullable: true })
	memberData?: Member;
}

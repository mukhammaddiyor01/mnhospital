import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ArticleService } from './article.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { MemberType } from '../member/enums/member.enum';
import { UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Article, Articles } from './dto/article';
import { ArticleInput, ArticlesInquiry } from './dto/article.input';
import { ArticleUpdate } from './dto/article.update';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { WithoutGuard } from '../auth/guards/without.guard';
import { shapeIntoMongoObjectId } from '../../libs/config';

@Resolver()
export class ArticleResolver {
	constructor(private readonly articleService: ArticleService) {}

	@Roles(MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Mutation(() => Article)
	public async createArticle(
		@Args('input') input: ArticleInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Article> {
		console.log('Mutation: createArticle');
		return await this.articleService.createArticle(memberId, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Article)
	public async likeTargetArticle(
		@Args('articleId') input: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Article> {
		console.log('Mutation: likeTargetArticle');
		return await this.articleService.likeTargetArticle(memberId, shapeIntoMongoObjectId(input));
	}

	@Roles(MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Mutation(() => Article)
	public async updateArticle(
		@Args('input') input: ArticleUpdate,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Article> {
		console.log('Mutation: updateArticle');
		input._id = shapeIntoMongoObjectId(input._id);
		return await this.articleService.updateArticle(memberId, input);
	}

	@UseGuards(WithoutGuard)
	@Query(() => Article)
	public async getArticle(
		@Args('articleId') input: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Article> {
		console.log('Query: getArticle');
		return await this.articleService.getArticle(memberId, shapeIntoMongoObjectId(input));
	}

	@UseGuards(WithoutGuard)
	@Query(() => Articles)
	public async getArticles(
		@Args('input') input: ArticlesInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Articles> {
		console.log('Query: getArticles');
		return await this.articleService.getArticles(memberId, input);
	}
	@Roles(MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Query(() => Articles)
	public async getMyArticles(@Args('input') input: ArticlesInquiry, @AuthMember('_id') doctorId: ObjectId): Promise<Articles> {
		return this.articleService.getMyArticles(doctorId, input);
	}

}

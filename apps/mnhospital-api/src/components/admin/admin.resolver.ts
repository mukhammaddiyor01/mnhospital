import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType } from '../member/enums/member.enum';
import { AdminService } from './admin.service';
import { Member, Members } from '../member/dto/member';
import { MembersInquiry } from '../member/dto/member.input';
import { MemberUpdate } from '../member/dto/member.update';
import { Service, Services } from '../service/dto/service';
import { ServicesInquiry } from '../service/dto/service.input';
import { ServiceUpdate } from '../service/dto/service.update';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { Article, Articles } from '../article/dto/article';
import { ArticlesInquiry } from '../article/dto/article.input';
import { ArticleUpdate } from '../article/dto/article.update';
import { Comment } from '../comment/dto/comment';
import { Admin } from './dto/admin';
import { AdminLoginInput } from './dto/admin.input';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;

@Resolver()
export class AdminResolver {
	constructor(private readonly adminService: AdminService) {}

	@Mutation(() => Admin)
	public async loginAdmin(@Args('input') input: AdminLoginInput): Promise<Admin> {
		console.log('Mutation: loginAdmin');
		return this.adminService.loginAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => Admin)
	public async getMyAdminProfile(@AuthMember('_id') adminId: ObjectId): Promise<Admin> {
		console.log('Query: getMyAdminProfile');
		return this.adminService.getMyProfile(adminId);
	}
	/** MEMBER */
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Members)
	public async getAllMembersByAdmin(@Args('input') input: MembersInquiry): Promise<Members> {
		console.log('Mutation: getAllMembersByAdmin');
		return this.adminService.getAllMembersByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Member)
	public async updateMemberByAdmin(@Args('input') input: MemberUpdate): Promise<Member> {
		console.log('Mutation: updateMemberByAdmin');
		return await this.adminService.updateMemberByAdmin(input);
	}

	/** SERVER */

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Services)
	public async getAllServicesByAdmin(@Args('input') input: ServicesInquiry): Promise<Services> {
		console.log('Mutation: getAllServicesByAdmin');
		return await this.adminService.getAllServicesByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Service)
	public async updateServiceByAdmin(@Args('input') input: ServiceUpdate): Promise<Service> {
		console.log('Mutation: updateServiceByAdmin');
		input._id = shapeIntoMongoObjectId(input._id);
		return await this.adminService.updateServiceByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Service)
	public async removeServiceByAdmin(@Args('serviceId') input: string): Promise<Service> {
		console.log('Mutation: removeServiceByAdmin');
		return await this.adminService.removeServiceByAdmin(shapeIntoMongoObjectId(input));
	}

	/** ARTICLE */
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => Articles)
	public async getAllArticlesByAdmin(@Args('input') input: ArticlesInquiry): Promise<Articles> {
		console.log('Query: getAllArticlesByAdmin');
		return await this.adminService.getAllArticlesByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Article)
	public async updateArticleByAdmin(@Args('input') input: ArticleUpdate): Promise<Article> {
		console.log('Mutation: updateArticleByAdmin');
		input._id = shapeIntoMongoObjectId(input._id);
		return await this.adminService.updateArticleByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Article)
	public async removeArticleByAdmin(@Args('articleId') input: string): Promise<Article> {
		console.log('Mutation: removeArticleByAdmin');
		return await this.adminService.removeArticleByAdmin(shapeIntoMongoObjectId(input));
	}

	/** COMMENT */

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation((returns) => Comment)
	public async removeCommentByAdmin(@Args('commentId') input: string): Promise<Comment> {
		console.log('Mutation: removeCommentByAdmin');
		const commentId = shapeIntoMongoObjectId(input);
		return await this.adminService.removeCommentByAdmin(commentId);
	}
}

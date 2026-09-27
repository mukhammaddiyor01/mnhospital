import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { WithoutGuard } from '../auth/guards/without.guard';
import { MemberType } from '../member/enums/member.enum';
import { Notice, Notices } from './dto/notification';
import { NoticeInput, NoticeInquiry, NoticeUpdateInput } from './dto/notification.input';
import { NoticeService } from './notice.service';
import { shapeIntoMongoObjectId } from '../../libs/config';

@Resolver()
export class NoticeResolver {
	constructor(private readonly noticeService: NoticeService) {}

	@UseGuards(WithoutGuard)
	@Query(() => Notices)
	public async getPublishedNotices(@Args('input') input: NoticeInquiry): Promise<Notices> {
		console.log('Query: getPublishedNotices');
		return await this.noticeService.getPublishedNotices(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => Notices)
	public async getNoticesByAdmin(@Args('input') input: NoticeInquiry): Promise<Notices> {
		console.log('Query: getNoticesByAdmin');
		return await this.noticeService.getNoticesByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Notice)
	public async createNotice(
		@Args('input') input: NoticeInput,
		@AuthMember('_id') adminId: ObjectId,
	): Promise<Notice> {
		console.log('Mutation: createNotice');
		return await this.noticeService.createNotice(adminId, input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Notice)
	public async updateNotice(@Args('input') input: NoticeUpdateInput): Promise<Notice> {
		console.log('Mutation: updateNotice');
		return await this.noticeService.updateNotice(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Notice)
	public async archiveNotice(@Args('noticeId') noticeId: string): Promise<Notice> {
		console.log('Mutation: archiveNotice');
		return await this.noticeService.archiveNotice(shapeIntoMongoObjectId(noticeId));
	}
}

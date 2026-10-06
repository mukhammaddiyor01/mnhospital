import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { MemberService } from './member.service';
import { LoginInput, MemberInput, SocialAuthInput } from './dto/member.input';
import { Member } from './dto/member';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Roles } from '../auth/decorators/roles.decorator';
import { MemberType } from './enums/member.enum';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberUpdate } from './dto/member.update';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { WithoutGuard } from '../auth/guards/without.guard';
import { unlink } from 'fs/promises';
import { checkUploadTarget, saveUploadedImage } from '../../libs/upload-image';
import { GraphQLUpload, FileUpload } from 'graphql-upload';

@Resolver()
export class MemberResolver {
	constructor(private readonly memberService: MemberService) {}

	@Mutation(() => Member)
	public async signup(@Args('input') input: MemberInput): Promise<Member> {
		console.log('Mutation: sign up');
		return this.memberService.signup(input);
	}

	@Mutation(() => Member)
	public async login(@Args('input') input: LoginInput): Promise<Member> {
		console.log('Mutation: login');
		return this.memberService.login(input);
	}

	@Mutation(() => Member)
	public async socialAuthenticate(@Args('input') input: SocialAuthInput): Promise<Member> {
		console.log('Mutation: social authenticate');
		return this.memberService.socialAuthenticate(input);
	}

	@UseGuards(AuthGuard)
	@Query(() => String)
	public async checkAuth(@AuthMember('memberNick') memberNick: string): Promise<string> {
		console.log('Query: memberNick ');
		return `Hi ${memberNick}`;
	}

	@Roles(MemberType.PATIENT, MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Query(() => String)
	public async checkAuthRoles(@AuthMember() authMember: Member): Promise<string> {
		console.log('Query: memberNick ');
		return `Hi ${authMember.memberNick}, you are ${authMember.memberType} ${authMember._id}`;
	}

	// Authenticated
	@UseGuards(AuthGuard)
	@Mutation(() => Member)
	public async updateMember(
		@Args('input') input: MemberUpdate,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Member> {
		console.log('Mutation: updateMember ');
		delete input._id;
		return this.memberService.updateMember(memberId, input);
	}

	@UseGuards(WithoutGuard)
	@Query(() => Member)
	public async getMember(@Args('memberId') input: string, @AuthMember('_id') memberId: ObjectId): Promise<Member> {
		console.log('Query: getMember');
		console.log('memberId:', memberId);
		const targetId = shapeIntoMongoObjectId(input);
		return this.memberService.getMember(memberId, targetId);
	}

	/** LIKE */

	@UseGuards(AuthGuard)
	@Mutation(() => Member)
	public async likeTargetMember(
		@Args('memberId') input: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Member> {
		console.log('Mutation: likeTargetMember');
		const likeRefId = shapeIntoMongoObjectId(input);
		return await this.memberService.likeTargetMember(memberId, likeRefId);
	}

	/** UPLOADER **/

	@UseGuards(AuthGuard)
	@Mutation(() => String)
	public async imageUploader(
		@Args({ name: 'file', type: () => GraphQLUpload }) file: FileUpload | Promise<FileUpload>,
		@Args('target') target: string,
		@AuthMember() actor: { memberType: MemberType },
	): Promise<string> {
		checkUploadTarget(target, actor.memberType);
		return saveUploadedImage(file, target);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => [String])
	public async imagesUploader(
		@Args('files', { type: () => [GraphQLUpload] }) files: (FileUpload | Promise<FileUpload>)[],
		@Args('target') target: string,
		@AuthMember() actor: { memberType: MemberType },
	): Promise<string[]> {
		checkUploadTarget(target, actor.memberType);
		if (!files.length || files.length > 10) throw new BadRequestException('Upload between 1 and 10 images');
		const results = await Promise.allSettled(files.map((file) => saveUploadedImage(file, target)));
		const successful = results
			.filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
			.map((result) => result.value);
		const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
		if (failed) {
			await Promise.all(successful.map((path) => unlink(path).catch(() => undefined)));
			throw failed.reason;
		}
		return successful;
	}
}

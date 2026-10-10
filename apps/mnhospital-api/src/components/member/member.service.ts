import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { LoginInput, MemberInput, SocialAuthInput } from './dto/member.input';
import { Member } from './dto/member';
import { MemberAuthType, MemberStatus, MemberType } from './enums/member.enum';
import { Message } from '../../libs/enums/common.enum';
import { AuthService } from '../auth/auth.service';
import { MemberUpdate } from './dto/member.update';
import { StatisticModifier, T } from '../../libs/types/common';
import { ViewService } from '../view/view.service';
import { ViewInput } from '../view/dto/view.input';
import { ViewGroup } from '../view/enums/view.enum';
import { LikeService } from '../like/like.service';
import { LikeInput } from '../like/dto/like.input';
import { LikeGroup } from '../like/enums/like.enum';
import { Follower, Following, MeFollowed } from '../follow/dto/follow';
import { SocialAuthService } from './social-auth.service';
import { createHash } from 'crypto';

@Injectable()
export class MemberService {
	constructor(
		@InjectModel('Member') private readonly memberModel: Model<Member>,
		@InjectModel('Follow') private readonly followModel: Model<Follower | Following>,
		private authService: AuthService,
		private viewService: ViewService,
		private likeService: LikeService,
		private socialAuthService: SocialAuthService,
	) {}

	public async signup(input: MemberInput): Promise<Member> {
		if (input.memberType && input.memberType !== MemberType.PATIENT) {
			throw new BadRequestException(Message.NOT_ALLOWED_REQUEST);
		}
		input.memberType = MemberType.PATIENT;
		input.memberAuthType = MemberAuthType.PHONE;
		//TODO: Hash password
		input.memberPassword = await this.authService.hashPassword(input.memberPassword);

		try {
			const result = await this.memberModel.create(input);

			return result;
		} catch (err) {
			console.log('Error, Service.model:', err.message);
			throw new BadRequestException(Message.USED_MEMBER_NICK_OR_PHONE);
		}
	}

	public async login(input: LoginInput): Promise<Member> {
		const { memberNick, memberPassword } = input;
		const response: Member = await this.memberModel
			.findOne({ memberNick, memberType: MemberType.PATIENT, deletedAt: { $exists: false } })
			.select('+memberPassword')
			.exec();

		if (!response || response.memberStatus === MemberStatus.DELETE) {
			throw new InternalServerErrorException(Message.NO_MEMBER_NICK);
		} else if (response.memberStatus === MemberStatus.BLOCK) {
			throw new InternalServerErrorException(Message.BLOCKED_USER);
		}

		// TODO: Compare Passwords
		const isMatch = await this.authService.comparePassword(memberPassword, response.memberPassword);
		if (!isMatch) throw new InternalServerErrorException(Message.WRONG_PASSWORD);

		return response;
	}

	public async socialAuthenticate(input: SocialAuthInput): Promise<Member> {
		const profile = await this.socialAuthService.authenticate(input);
		const memberSocialId = `${profile.provider}:${profile.subject}`;
		let member = await this.memberModel
			.findOne({ memberSocialId, memberType: MemberType.PATIENT, deletedAt: { $exists: false } })
			.exec();

		if (!member) {
			const suffix = createHash('sha256').update(memberSocialId).digest('hex').slice(0, 7);
			const nameBase =
				(profile.fullName ?? profile.provider)
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '')
					.slice(0, 20) || 'patient';
			const memberMail =
				profile.email && !(await this.memberModel.exists({ memberMail: profile.email })) ? profile.email : undefined;
			try {
				member = await this.memberModel.create({
					memberType: MemberType.PATIENT,
					memberStatus: MemberStatus.ACTIVE,
					memberAuthType: profile.provider,
					memberSocialId,
					memberNick: `${nameBase}-${suffix}`,
					memberFullName: profile.fullName,
					memberMail,
					memberImage: profile.image ?? '',
				});
			} catch {
				member = await this.memberModel
					.findOne({ memberSocialId, memberType: MemberType.PATIENT, deletedAt: { $exists: false } })
					.exec();
				if (!member) throw new BadRequestException('Unable to create the social patient account.');
			}
		}

		if (member.memberStatus === MemberStatus.DELETE) throw new InternalServerErrorException(Message.NO_MEMBER_NICK);
		if (member.memberStatus === MemberStatus.BLOCK) throw new InternalServerErrorException(Message.BLOCKED_USER);
		if (![MemberAuthType.GOOGLE, MemberAuthType.NAVER, MemberAuthType.KAKAO].includes(member.memberAuthType)) {
			throw new BadRequestException('This account is not linked to the selected provider.');
		}

		return member;
	}

	// Authenticated

	public async updateMember(memberId: ObjectId, input: MemberUpdate): Promise<Member> {
		const updateData: T = {};
		for (const key of [
			'memberPhone',
			'memberMail',
			'memberNick',
			'memberFullName',
			'memberIdNumber',
			'memberImage',
			'memberDesc',
			'memberAddress',
		]) {
			if (input[key] !== undefined) updateData[key] = input[key];
		}
		const passwordChanged = input.memberPassword !== undefined;
		if (passwordChanged) {
			if (
				typeof input.memberPassword !== 'string' ||
				input.memberPassword.length < 8 ||
				input.memberPassword.length > 32
			)
				throw new BadRequestException('Invalid password');
			updateData.memberPassword = await this.authService.hashPassword(input.memberPassword);
		}
		if (!Object.keys(updateData).length) throw new BadRequestException('No profile changes were provided');

		let result: Member;
		try {
			result = await this.memberModel
				.findOneAndUpdate(
					{
						_id: memberId,
						memberType: MemberType.PATIENT,
						memberStatus: MemberStatus.ACTIVE,
						deletedAt: { $exists: false },
					},
					{ $set: updateData, ...(passwordChanged ? { $inc: { sessionVersion: 1 } } : {}) },
					{ new: true, runValidators: true },
				)
				.exec();
		} catch (error) {
			const duplicate = error as { code?: number; keyPattern?: Record<string, number> };
			if (duplicate.code === 11000 && duplicate.keyPattern?.memberPhone) {
				throw new BadRequestException('This phone number is already in use.');
			}
			if (duplicate.code === 11000 && duplicate.keyPattern?.memberMail) {
				throw new BadRequestException('This email address is already in use.');
			}
			throw error;
		}
		if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);
		if (passwordChanged) await this.authService.revokeOwnerSessions(memberId, MemberType.PATIENT);
		return result;
	}

	public async getMyProfile(memberId: ObjectId): Promise<Member> {
		const member = await this.memberModel
			.findOne({
				_id: memberId,
				memberType: MemberType.PATIENT,
				memberStatus: MemberStatus.ACTIVE,
				deletedAt: { $exists: false },
			})
			.exec();
		if (!member) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		return member;
	}

	public async getMember(memberId: ObjectId, targetId: ObjectId): Promise<Member> {
		const search: T = {
			_id: targetId,
			memberStatus: {
				$in: [MemberStatus.ACTIVE, MemberStatus.BLOCK],
			},
		};
		const targetMember = await this.memberModel.findOne(search).lean().exec();
		if (!targetMember) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		if (memberId) {
			// Record a unique member profile view, excluding the owner.
			if (String(memberId) !== String(targetId)) {
			const viewInput: ViewInput = {
				memberId,
				viewRefId: targetId,
				viewGroup: ViewGroup.MEMBER,
			};
			const newView = await this.viewService.recordView(viewInput);
			if (newView) {
				await this.memberModel.findByIdAndUpdate(targetId, { $inc: { memberViews: 1 } }).exec();
				targetMember.memberViews++;
			}

			}
			const likeInput: LikeInput = {
				memberId,
				likeRefId: targetId,
				likeGroup: LikeGroup.MEMBER,
			};
			targetMember.meLiked = await this.likeService.checkLikeExistence(likeInput);
			targetMember.meFollowed = await this.checkSubscription(memberId, targetId);
		}

		return targetMember;
	}

	public async checkSubscription(followerId: ObjectId, followingId: ObjectId): Promise<MeFollowed[]> {
		const result = await this.followModel.findOne({ followingId: followingId, followerId: followerId }).exec();
		return result ? [{ followerId: followerId, followingId: followingId, myFollowing: true }] : [];
	}

	public async memberStatisticEditor(input: StatisticModifier): Promise<Member> {
		const { _id, targetKey, modifier } = input;

		const allowedKeys = [
			'memberConversation',
			'memberServices',
			'memberArticles',
			'memberFollowers',
			'memberFollowings',
			'memberLikes',
			'memberViews',
			'memberComments',
			'memberPoints',
			'memberRank',
			'memberReports',
		];

		if (!allowedKeys.includes(targetKey)) {
			throw new BadRequestException('Invalid statistic key');
		}

		const result = await this.memberModel
			.findOneAndUpdate({ _id }, { $inc: { [targetKey]: modifier } }, { new: true })
			.exec();

		if (!result) {
			throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		}

		return result;
	}

	/** Compatibility wrapper for existing status-editor calls. */
	public async memberStatusEditor(input: StatisticModifier): Promise<Member> {
		return this.memberStatisticEditor(input);
	}

	/** LIKE Part */

	public async likeTargetMember(memberId: ObjectId, likeRefId: ObjectId): Promise<Member> {
		const target: Member = await this.memberModel.findOne({ _id: likeRefId, memberStatus: MemberStatus.ACTIVE }).exec();
		if (!target) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const input: LikeInput = {
			memberId: memberId,
			likeRefId: likeRefId,
			likeGroup: LikeGroup.MEMBER,
		};

		// LIKE TOGGLE - like bo'lsa -1, bo'lmasa +1
		const modifier: number = await this.likeService.toggleLike(input);
		const result = await this.memberStatisticEditor({ _id: likeRefId, targetKey: 'memberLikes', modifier: modifier });

		if (!result) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
		result.meLiked = await this.likeService.checkLikeExistence(input);
		return result;
	}
}

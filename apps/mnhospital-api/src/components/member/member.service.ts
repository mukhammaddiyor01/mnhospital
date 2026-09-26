import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { LoginInput, MemberInput } from './dto/member.input';
import { Member } from './dto/member';
import { MemberStatus, MemberType } from './enums/member.enum';
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

@Injectable()
export class MemberService {
	constructor(
		@InjectModel('Member') private readonly memberModel: Model<Member>,
		private authService: AuthService,
		private viewService: ViewService,
		private likeService: LikeService,
	) {}

	public async signup(input: MemberInput): Promise<Member> {
		if (input.memberType === MemberType.DOCTOR) {
			throw new BadRequestException(Message.DOCTOR_SIGNUP_REQUIRED);
		}
		//TODO: Hash password
		input.memberPassword = await this.authService.hashPassword(input.memberPassword);

		try {
			const result = await this.memberModel.create(input);
			//TODO: Authentication via Token
			result.accessToken = await this.authService.createToken(result);

			return result;
		} catch (err) {
			console.log('Error, Service.model:', err.message);
			throw new BadRequestException(Message.USED_MEMBER_NICK_OR_PHONE);
		}
	}

	public async login(input: LoginInput): Promise<Member> {
		const { memberNick, memberPassword } = input;
		const response: Member = await this.memberModel
			.findOne({ memberNick: memberNick })
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
		response.accessToken = await this.authService.createToken(response);

		return response;
	}

	// Authenticated

	public async updateMember(memberId: ObjectId, input: MemberUpdate): Promise<Member> {
		const result: Member = await this.memberModel
			.findOneAndUpdate(
				{
					_id: memberId,
					memberStatus: MemberStatus.ACTIVE,
				},
				input,
				{ new: true },
			)
			.exec();
		if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);

		result.accessToken = await this.authService.createToken(result);
		return result;
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
			// Record a unique member profile view.
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

			const likeInput: LikeInput = {
				memberId,
				likeRefId: targetId,
				likeGroup: LikeGroup.MEMBER,
			};
			targetMember.meLiked = await this.likeService.checkLikeExistence(likeInput);
		}

		return targetMember;
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
		return result;
	}
}

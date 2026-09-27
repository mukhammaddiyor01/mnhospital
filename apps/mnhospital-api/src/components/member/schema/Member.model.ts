import { Schema } from 'mongoose';
import { MemberAuthType, MemberStatus, MemberType } from '../enums/member.enum';

const MemberSchema = new Schema(
	{
		memberType: {
			type: String,
			enum: MemberType,
			default: MemberType.PATIENT,
		},
		memberStatus: {
			type: String,
			enum: MemberStatus,
			default: MemberStatus.ACTIVE,
		},
		memberAuthType: {
			type: String,
			enum: MemberAuthType,
			default: MemberAuthType.PHONE,
		},
		memberPhone: {
			type: String,
			index: {
				unique: true,
				sparse: true,
			},
		},
		memberMail: {
			type: String,
			index: {
				unique: true,
				sparse: true,
			},
			lowercase: true,
		},
		memberNick: {
			type: String,
			index: {
				unique: true,
				sparse: true,
			},
			required: true,
		},
		memberPassword: {
			type: String,
			select: false,
		},
		memberSocialId: {
			type: String,
			index: {
				unique: true,
				sparse: true,
			},
		},
		memberFullName: {
			type: String,
		},
		memberIdNumber: {
			type: String,
		},
		memberImage: {
			type: String,
			default: '',
		},
		memberDesc: {
			type: String,
		},
		memberConversation: {
			type: Number,
			default: 0,
		},
		memberAddress: {
			type: Number,
			default: 0,
		},
		memberServices: {
			type: Number,
			default: 0,
		},
		memberArticles: {
			type: Number,
			default: 0,
		},
		memberFollowers: {
			type: Number,
			default: 0,
		},
		memberFollowings: {
			type: Number,
			default: 0,
		},
		memberLikes: {
			type: Number,
			default: 0,
		},
		memberViews: {
			type: Number,
			default: 0,
		},
		memberComments: {
			type: Number,
			default: 0,
		},
		memberPoints: {
			type: Number,
			default: 0,
		},
		memberRank: {
			type: Number,
			default: 0,
		},
		memberReports: {
			type: Number,
			default: 0,
		},
		deletedAt: {
			type: Date,
		},
	},
	{ timestamps: true, collection: 'members' },
);

export default MemberSchema;

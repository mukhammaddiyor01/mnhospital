import { Field, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { MemberAuthType, MemberStatus, MemberType } from '../../member/enums/member.enum';
import { TotalCounter } from '../../member/dto/member';

@ObjectType()
export class Receptionist {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => MemberType)
	memberType: MemberType;

	@Field(() => MemberStatus)
	memberStatus: MemberStatus;

	@Field(() => MemberAuthType)
	memberAuthType: MemberAuthType;

	@Field(() => String)
	receptionistNick: string;

	receptionistPassword?: string;

	@Field(() => String)
	receptionistPhone: string;

	@Field(() => String)
	receptionistMail: string;

	@Field(() => String)
	receptionistFullName: string;

	@Field(() => String)
	receptionistImage: string;

	@Field(() => String, { nullable: true })
	receptionistAddress?: string;

	@Field(() => String, { nullable: true })
	receptionistDesc?: string;

	@Field(() => Date, { nullable: true })
	deletedAt?: Date;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;

	@Field(() => String, { nullable: true })
	accessToken?: string;
}

@ObjectType()
export class Receptionists {
	@Field(() => [Receptionist])
	list: Receptionist[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter?: TotalCounter[];
}

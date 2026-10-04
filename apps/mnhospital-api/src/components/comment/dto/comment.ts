import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { TotalCounter } from '../../member/dto/member';
import { Member } from '../../member/dto/member';
import { Doctor } from '../../doctor/dto/doctor';
import { ReferenceGroup } from '../../../libs/enums/reference.enum';
import { CommentStatus } from '../enums/comment.enum';

@ObjectType()
export class Comment {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => CommentStatus)
	commentStatus: CommentStatus;

	@Field(() => ReferenceGroup)
	commentGroup: ReferenceGroup;

	@Field(() => String)
	commentContent: string;

	@Field(() => String)
	commentRefId: ObjectId;

	@Field(() => String)
	memberId: ObjectId;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;

	/** from aggregation */
	@Field(() => Member, { nullable: true })
	memberData?: Member;

	@Field(() => Doctor, { nullable: true })
	doctorData?: Doctor;
}

@ObjectType()
export class Comments {
	@Field(() => [Comment])
	list: Comment[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter: TotalCounter[];
}

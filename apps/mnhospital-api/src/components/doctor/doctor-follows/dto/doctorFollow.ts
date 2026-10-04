import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { MeLiked } from '../../../like/dto/like';
import { Member, TotalCounter } from '../../../member/dto/member';
import { Doctor } from '../../dto/doctor';

@ObjectType()
export class DoctorMeFollowed {
	@Field(() => String)
	doctorId: ObjectId;

	@Field(() => String)
	memberId: ObjectId;

	@Field(() => Boolean)
	myFollowing: boolean;
}

@ObjectType()
export class DoctorFollower {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	doctorId: ObjectId;

	@Field(() => String)
	memberId: ObjectId;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;

	@Field(() => [MeLiked], { nullable: true })
	meLiked?: MeLiked[];

	@Field(() => [DoctorMeFollowed], { nullable: true })
	meFollowed?: DoctorMeFollowed[];

	@Field(() => Member, { nullable: true })
	memberData?: Member;

	@Field(() => Doctor, { nullable: true })
	followerDoctorData?: Doctor;
}

@ObjectType()
export class DoctorFollowing {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	doctorId: ObjectId;

	@Field(() => String)
	memberId: ObjectId;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;

	@Field(() => [MeLiked], { nullable: true })
	meLiked?: MeLiked[];

	@Field(() => [DoctorMeFollowed], { nullable: true })
	meFollowed?: DoctorMeFollowed[];

	@Field(() => Doctor, { nullable: true })
	doctorData?: Doctor;
}

@ObjectType()
export class DoctorFollowings {
	@Field(() => [DoctorFollowing])
	list: DoctorFollowing[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter: TotalCounter[];
}

@ObjectType()
export class DoctorFollowers {
	@Field(() => [DoctorFollower])
	list: DoctorFollower[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter: TotalCounter[];
}

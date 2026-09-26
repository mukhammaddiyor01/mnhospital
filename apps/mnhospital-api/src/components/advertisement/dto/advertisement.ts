import { Field, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { TotalCounter } from '../../member/dto/member';
import { AdvertisementStatus } from '../enums/advertisement.enum';

@ObjectType()
export class Advertisement {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	createdByMemberId: ObjectId;

	@Field(() => AdvertisementStatus)
	advertisementStatus: AdvertisementStatus;

	@Field(() => String)
	advertisementTitle: string;

	@Field(() => String)
	advertisementContent: string;

	@Field(() => String, { nullable: true })
	advertisementImage?: string;

	@Field(() => String, { nullable: true })
	advertisementLink?: string;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}

@ObjectType()
export class Advertisements {
	@Field(() => [Advertisement])
	list: Advertisement[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter: TotalCounter[];
}

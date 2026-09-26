import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { ServiceRoom, ServiceRoomName, ServiceStatus, ServiceType } from '../enums/service.enum';
import { TotalCounter } from '../../member/dto/member';
import { Doctor } from '../../doctor/dto/doctor';
import { MeLiked } from '../../like/dto/like';

@ObjectType()
export class Service {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	serviceName: string;

	@Field(() => String)
	departmentId: ObjectId;

	@Field(() => ServiceType)
	serviceType: ServiceType;

	@Field(() => ServiceStatus)
	serviceStatus: ServiceStatus;

	@Field(() => ServiceRoomName)
	serviceRoomName: ServiceRoomName;

	@Field(() => ServiceRoom)
	serviceRoom: ServiceRoom;

	@Field(() => String)
	serviceTitle: string;

	@Field(() => Number)
	servicePrice: number;

	@Field(() => Int)
	serviceViews: number;

	@Field(() => Int)
	serviceLikes: number;

	@Field(() => Int)
	serviceComments: number;

	@Field(() => [MeLiked], { nullable: true })
	meLiked?: MeLiked[];

	@Field(() => Int)
	serviceRank: number;

	@Field(() => [String])
	serviceImages?: string[];

	@Field(() => String, { nullable: true })
	serviceDesc?: string;

	@Field(() => String)
	memberId: ObjectId;

	@Field(() => Date, { nullable: true })
	reservedAt?: Date;

	@Field(() => Date, { nullable: true })
	deletedAt?: Date;

	@Field(() => Date, { nullable: true })
	endedAt?: Date;

	@Field(() => String, { nullable: true })
	serviceDuration?: string;

	@Field(() => Date, { nullable: true })
	openedAt?: Date;

	@Field(() => Date, { nullable: true })
	closedAt?: Date;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;

	@Field(() => String, { nullable: true })
	accessToken?: string;

	/** from AGGREGATION */

	@Field(() => Doctor, { nullable: true })
	memberData?: Doctor;
}

@ObjectType()
export class Services {
	@Field(() => [Service])
	list: Service[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter: TotalCounter[];
}

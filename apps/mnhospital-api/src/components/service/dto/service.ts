import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { ServiceRoom, ServiceRoomName, ServiceStatus, ServiceType } from '../enums/service.enum';
import { Member } from '../../member/dto/member';

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

	@Field(() => String)
	serviceComments: number;

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

	@Field(() => Member, { nullable: true })
	memberData?: Member;
}

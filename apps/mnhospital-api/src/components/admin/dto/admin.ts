import { Field, Int, ObjectType } from '@nestjs/graphql';

import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { AdminType } from '../enums/admin.enum';

@ObjectType()
export class Admin {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => AdminType)
	adminType: AdminType;

	@Field(() => String)
	adminNick: string;

	adminPassword?: string;

	@Field(() => String)
	adminPhone: string;

	@Field(() => String, { nullable: true })
	adminMail?: string;

	@Field(() => String)
	adminImage: string;

	@Field(() => String, { nullable: true })
	adminDesc?: string;

	@Field(() => Date, { nullable: true })
	deletedAt?: Date;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;

	@Field(() => String, { nullable: true })
	accessToken?: string;
}

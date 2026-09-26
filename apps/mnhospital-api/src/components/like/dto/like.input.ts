import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEnum, IsInstance, IsNotEmpty } from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { ReferenceGroup } from '../../../libs/enums/reference.enum';

@InputType()
export class LikeInput {
	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: 'likeRefId must be a valid ObjectId' })
	@IsNotEmpty()
	@Field(() => String)
	likeRefId: ObjectId;

	@IsEnum(ReferenceGroup)
	@IsNotEmpty()
	@Field(() => ReferenceGroup)
	likeGroup: ReferenceGroup;

	/** Set from the authenticated member, not from GraphQL input. */
	memberId?: ObjectId;
}

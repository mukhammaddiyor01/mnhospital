import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEnum, IsInstance, IsNotEmpty } from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { ViewGroup } from '../enums/view.enum';

@InputType()
export class ViewInput {
	@IsEnum(ViewGroup)
	@IsNotEmpty()
	@Field(() => ViewGroup)
	viewGroup: ViewGroup;

	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: 'viewRefId must be a valid ObjectId' })
	@IsNotEmpty()
	@Field(() => String)
	viewRefId: ObjectId;

	@Transform(({ value }) => (typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value))
	@IsInstance(ObjectId, { message: 'memberId must be a valid ObjectId' })
	@IsNotEmpty()
	@Field(() => String)
	memberId: ObjectId;
}

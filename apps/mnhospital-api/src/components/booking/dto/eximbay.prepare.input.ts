import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsInstance, IsNotEmpty } from 'class-validator';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;

const toObjectId = ({ value }: { value: unknown }) =>
	typeof value === 'string' && ObjectId.isValid(value) ? new ObjectId(value) : value;

@InputType()
export class EximbayPrepareInput {
	@Transform(toObjectId)
	@IsInstance(ObjectId)
	@IsNotEmpty()
	@Field(() => String)
	paymentId: ObjectId;
}

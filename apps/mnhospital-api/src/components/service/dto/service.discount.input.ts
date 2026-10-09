import { Field, Float, InputType } from '@nestjs/graphql';
import { IsMongoId, IsNumber, Max, Min } from 'class-validator';
@InputType()
export class ServiceDiscountInput {
	@IsMongoId() @Field(() => String) serviceId: string;
	@IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) @Field(() => Float) discountPercent: number;
}

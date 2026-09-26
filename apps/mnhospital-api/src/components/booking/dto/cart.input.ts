import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, Length } from 'class-validator';

@InputType()
export class CartInput {
	@IsOptional()
	@IsString()
	@Length(3, 3)
	@Field(() => String, { nullable: true, defaultValue: 'UZS' })
	currency?: string = 'UZS';
}

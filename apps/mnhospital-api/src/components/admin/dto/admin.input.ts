import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, Length } from 'class-validator';

@InputType()
export class AdminLoginInput {
	@IsString()
	@IsNotEmpty()
	@Length(3, 30)
	@Field(() => String)
	adminNick: string;

	@IsString()
	@IsNotEmpty()
	@Length(8, 32)
	@Field(() => String)
	adminPassword: string;
}

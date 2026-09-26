import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PaymentStatus } from '../../patient/enums/patient.enum';

@InputType()
export class PaymentInquiry {
	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 1 })
	page: number = 1;

	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 10 })
	limit: number = 10;

	@IsOptional()
	@IsEnum(PaymentStatus)
	@Field(() => PaymentStatus, { nullable: true })
	status?: PaymentStatus;
}

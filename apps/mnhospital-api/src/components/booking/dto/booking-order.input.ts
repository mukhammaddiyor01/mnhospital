import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { BookingOrderStatus } from '../../patient/enums/patient.enum';

@InputType()
export class BookingOrderInquiry {
	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 1 })
	page: number = 1;

	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 10 })
	limit: number = 10;

	@IsOptional()
	@IsEnum(BookingOrderStatus)
	@Field(() => BookingOrderStatus, { nullable: true })
	status?: BookingOrderStatus;
}

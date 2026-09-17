import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Direction } from '../../../libs/enums/common.enum';
import { DoctorSort, DoctorSpecialty } from '../enums/doctor.enum';

@InputType()
export class DoctorsInquiry {
	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 1 })
	page: number = 1;

	@IsInt()
	@Min(1)
	@Max(100)
	@Field(() => Int, { defaultValue: 10 })
	limit: number = 10;

	@IsOptional()
	@IsEnum(DoctorSpecialty)
	@Field(() => DoctorSpecialty, { nullable: true })
	docSpecialty?: DoctorSpecialty;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	search?: string;

	@IsOptional()
	@IsEnum(DoctorSort)
	@Field(() => DoctorSort, { nullable: true })
	sort?: DoctorSort;

	@IsOptional()
	@IsEnum(Direction)
	@Field(() => Direction, { nullable: true })
	direction?: Direction;
}

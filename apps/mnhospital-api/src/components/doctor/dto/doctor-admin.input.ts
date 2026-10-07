import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsInstance, IsInt, IsNotEmpty, IsString, Length, Min, ValidateIf } from 'class-validator';
import { Types } from 'mongoose';
import { DoctorProfileUpdateInput } from './doctor-profile.input';
import { MemberStatus } from '../../member/enums/member.enum';
import { DoctorSpecialty } from '../enums/doctor.enum';

@InputType()
export class DoctorAdminUpdateInput extends DoctorProfileUpdateInput {
	@Transform(({ value }) =>
		typeof value === 'string' && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value,
	)
	@IsInstance(Types.ObjectId)
	@IsNotEmpty()
	@Field(() => String)
	_id: Types.ObjectId;

	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@ValidateIf((_, value) => value !== undefined)
	@IsString()
	@Length(0, 500)
	@Field(() => String, { nullable: true })
	docImage?: string;

	@ValidateIf((_, value) => value !== undefined)
	@IsInt()
	@Min(0)
	@Field(() => Int, { nullable: true })
	docExperience?: number;

	@ValidateIf((_, value) => value !== undefined)
	@IsEnum(DoctorSpecialty)
	@Field(() => DoctorSpecialty, { nullable: true })
	docSpecialty?: DoctorSpecialty;

	@ValidateIf((_, value) => value !== undefined)
	@IsEnum(MemberStatus)
	@IsIn([MemberStatus.ACTIVE, MemberStatus.BLOCK])
	@Field(() => MemberStatus, { nullable: true })
	memberStatus?: MemberStatus;
}

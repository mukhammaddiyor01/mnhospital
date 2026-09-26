import { Field, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { MemberStatus, MemberType } from '../../member/enums/member.enum';
import { PatientBloodType, PatientGender } from '../enums/patient.enum';

@ObjectType()
export class Patient {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	memberId: ObjectId;

	@Field(() => MemberType)
	memberType: MemberType;

	@Field(() => MemberStatus)
	memberStatus: MemberStatus;

	@Field(() => PatientBloodType)
	patientBloodType: PatientBloodType;

	@Field(() => PatientGender)
	patientGender: PatientGender;

	@Field(() => Date)
	patientBirthDate: Date;

	@Field(() => String)
	patientIdNumber: string;

	@Field(() => String, { nullable: true })
	patientFullName?: string;

	@Field(() => String, { nullable: true })
	patientImage?: string;

	@Field(() => String, { nullable: true })
	patientDesc?: string;

	@Field(() => String, { nullable: true })
	patientAddress?: string;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}

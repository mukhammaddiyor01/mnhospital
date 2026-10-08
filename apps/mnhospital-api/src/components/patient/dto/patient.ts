import { Field, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { MemberStatus, MemberType } from '../../member/enums/member.enum';
import { PatientBloodType, PatientGender } from '../enums/patient.enum';
import { TotalCounter } from '../../member/dto/member';

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

	@Field(() => PatientBloodType, { nullable: true })
	patientBloodType?: PatientBloodType;

	@Field(() => PatientGender, { nullable: true })
	patientGender?: PatientGender;

	@Field(() => Date, { nullable: true })
	patientBirthDate?: Date;

	@Field(() => String, { nullable: true })
	patientIdNumber?: string;

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

@ObjectType()
export class Patients {
	@Field(() => [Patient])
	list: Patient[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter?: TotalCounter[];
}

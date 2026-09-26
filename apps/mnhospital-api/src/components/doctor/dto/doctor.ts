import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { DoctorSpecialty } from '../enums/doctor.enum';
import { MemberAuthType, MemberStatus, MemberType } from '../../member/enums/member.enum';

@ObjectType()
export class Doctor {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => MemberType)
	memberType: MemberType;

	@Field(() => MemberStatus)
	memberStatus: MemberStatus;

	@Field(() => MemberAuthType)
	memberAuthType: MemberAuthType;

	@Field(() => String, { nullable: true })
	servicesId?: ObjectId;

	@Field(() => Int)
	docServices: number;

	@Field(() => Int)
	docArticles: number;

	@Field(() => Int)
	docLikes: number;

	@Field(() => String, { nullable: true })
	departmentId?: ObjectId;

	@Field(() => DoctorSpecialty, { nullable: true })
	docSpecialty?: DoctorSpecialty;

	@Field(() => String)
	docNick: string;

	docPassword?: string;

	@Field(() => String, { nullable: true })
	accessToken?: string;

	@Field(() => String)
	docPhone: string;

	@Field(() => String, { nullable: true })
	docMail?: string;

	@Field(() => String)
	docFullName: string;

	@Field(() => String)
	docImage: string;

	@Field(() => String)
	docAddress: string;

	@Field(() => String)
	docDesc: string;

	@Field(() => Int)
	docExperience: number;

	@Field(() => String)
	docRoom: string;

	@Field(() => Int)
	docPoints: number;

	@Field(() => Int)
	docPatients: number;

	@Field(() => Date, { nullable: true })
	deletedAt?: Date;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}

@ObjectType()
export class DoctorTotalCounter {
	@Field(() => Int)
	total: number;
}

@ObjectType()
export class Doctors {
	@Field(() => [Doctor])
	list: Doctor[];

	@Field(() => [DoctorTotalCounter])
	metaCounter: DoctorTotalCounter[];
}

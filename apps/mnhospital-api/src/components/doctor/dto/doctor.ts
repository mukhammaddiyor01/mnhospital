import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { DoctorSpecialty } from '../enums/doctor.enum';

@ObjectType()
export class Doctor {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	memberId: ObjectId;

	@Field(() => String)
	servicesId: ObjectId;

	@Field(() => String)
	departmentId: ObjectId;

	@Field(() => DoctorSpecialty)
	docSpecialty: DoctorSpecialty;

	@Field(() => String)
	docNick: string;

	docPassword?: string;

	@Field(() => String)
	docPhone: string;

	@Field(() => String)
	docMail: string;

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

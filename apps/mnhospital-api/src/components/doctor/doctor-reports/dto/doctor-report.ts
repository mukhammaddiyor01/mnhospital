import { Field, ObjectType, Int } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { DoctorReportFollowUp } from '../enums/doctor-report.enum';
import { TotalCounter } from '../../../member/dto/member';

@ObjectType()
export class DoctorReport {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	doctorId: ObjectId;

	@Field(() => String)
	patientId: ObjectId;

	@Field(() => String)
	appointmentId: ObjectId;

	@Field(() => String)
	serviceId: ObjectId;

	@Field(() => String)
	docReportSymptoms: string;

	@Field(() => String, { nullable: true })
	docReportObservations?: string;

	@Field(() => String)
	docReportDiagnosis: string;

	@Field(() => String, { nullable: true })
	docReportRecommendation?: string;

	@Field(() => String)
	docReportMedication: string;

	@Field(() => DoctorReportFollowUp)
	docReportFollowUp: DoctorReportFollowUp;

	@Field(() => Date, { nullable: true })
	docReportFollowUpDate?: Date;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}

@ObjectType()
export class DoctorReports {
	@Field(() => [DoctorReport])
	list: DoctorReport[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter?: TotalCounter[];
}

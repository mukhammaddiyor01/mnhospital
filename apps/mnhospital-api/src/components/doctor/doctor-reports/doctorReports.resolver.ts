import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { shapeIntoMongoObjectId } from '../../../libs/config';
import { AuthMember } from '../../auth/decorators/authMember.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { MemberType } from '../../member/enums/member.enum';
import { DoctorReport, DoctorReports } from './dto/doctor-report';
import { DoctorReportInput, DoctorReportInquiry, DoctorReportUpdateInput } from './dto/doctor-report.input';
import { DoctorReportsService } from './doctorReports.service';

@Resolver()
export class DoctorReportsResolver {
	constructor(private readonly doctorReportsService: DoctorReportsService) {}

	@Roles(MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Mutation(() => DoctorReport)
	public async createDoctorReport(
		@Args('input') input: DoctorReportInput,
		@AuthMember('_id') doctorId: ObjectId,
	): Promise<DoctorReport> {
		console.log('Mutation: createDoctorReport');
		return await this.doctorReportsService.createReport(doctorId, input);
	}

	@Roles(MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Mutation(() => DoctorReport)
	public async updateDoctorReport(
		@Args('input') input: DoctorReportUpdateInput,
		@AuthMember('_id') doctorId: ObjectId,
	): Promise<DoctorReport> {
		console.log('Mutation: updateDoctorReport');
		return await this.doctorReportsService.updateReport(doctorId, input);
	}

	@Roles(MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Query(() => DoctorReports)
	public async getMyDoctorReports(
		@Args('input') input: DoctorReportInquiry,
		@AuthMember('_id') doctorId: ObjectId,
	): Promise<DoctorReports> {
		console.log('Query: getMyDoctorReports');
		return await this.doctorReportsService.getMyDoctorReports(doctorId, input);
	}

	@Roles(MemberType.DOCTOR)
	@UseGuards(RolesGuard)
	@Query(() => DoctorReport)
	public async getMyDoctorReport(
		@Args('reportId') reportId: string,
		@AuthMember('_id') doctorId: ObjectId,
	): Promise<DoctorReport> {
		console.log('Query: getMyDoctorReport');
		return await this.doctorReportsService.getMyDoctorReport(doctorId, shapeIntoMongoObjectId(reportId));
	}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Query(() => DoctorReports)
	public async getMyPatientReports(
		@Args('input') input: DoctorReportInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<DoctorReports> {
		console.log('Query: getMyPatientReports');
		return await this.doctorReportsService.getMyPatientReports(memberId, input);
	}

	@Roles(MemberType.PATIENT)
	@UseGuards(RolesGuard)
	@Query(() => DoctorReport)
	public async getMyPatientReport(
		@Args('reportId') reportId: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<DoctorReport> {
		console.log('Query: getMyPatientReport');
		return await this.doctorReportsService.getMyPatientReport(memberId, shapeIntoMongoObjectId(reportId));
	}
}

import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Appointment } from '../../appointment/dto/appointment';
import { AppointmentStatus } from '../../../libs/enums/appointment.enum';
import { PatientService } from '../../patient/patient.service';
import { DoctorReport, DoctorReports } from './dto/doctor-report';
import { DoctorReportInput, DoctorReportInquiry, DoctorReportUpdateInput } from './dto/doctor-report.input';
import { DoctorReportFollowUp } from './enums/doctor-report.enum';

@Injectable()
export class DoctorReportsService {
	constructor(
		@InjectModel('DoctorReport') private readonly doctorReportModel: Model<DoctorReport>,
		@InjectModel('Appointment') private readonly appointmentModel: Model<Appointment>,
		private readonly patientService: PatientService,
	) {}

	public async createReport(doctorId: ObjectId, input: DoctorReportInput): Promise<DoctorReport> {
		const appointment = await this.appointmentModel
			.findOne({
				_id: input.appointmentId,
				doctorId,
				appointmentStatus: { $in: [AppointmentStatus.ENDED, AppointmentStatus.COMPLETED] },
			})
			.lean()
			.exec();
		if (!appointment) throw new BadRequestException('Only your ended or completed appointment can receive a report');

		const existing = await this.doctorReportModel.findOne({ appointmentId: appointment._id }).lean().exec();
		if (existing) throw new BadRequestException('A report already exists for this appointment');
		this.validateFollowUp(input.docReportFollowUp, input.docReportFollowUpDate);

		try {
			return await this.doctorReportModel.create({
				doctorId,
				patientId: appointment.patientId,
				appointmentId: appointment._id,
				serviceId: appointment.serviceId,
				docReportSymptoms: input.docReportSymptoms,
				docReportObservations: input.docReportObservations,
				docReportDiagnosis: input.docReportDiagnosis,
				docReportRecommendation: input.docReportRecommendation,
				docReportMedication: input.docReportMedication,
				docReportFollowUp: input.docReportFollowUp,
				docReportFollowUpDate: input.docReportFollowUpDate,
			});
		} catch (error) {
			throw new BadRequestException('Report creation failed because this appointment already has a report');
		}
	}

	public async updateReport(doctorId: ObjectId, input: DoctorReportUpdateInput): Promise<DoctorReport> {
		const report = await this.doctorReportModel.findOne({ _id: input.reportId, doctorId }).exec();
		if (!report) throw new InternalServerErrorException('Doctor report was not found');

		const followUp = input.docReportFollowUp ?? report.docReportFollowUp;
		const followUpDate = input.docReportFollowUpDate ?? report.docReportFollowUpDate;
		this.validateFollowUp(followUp, followUpDate);

		const updateData: Record<string, unknown> = { ...input };
		delete updateData.reportId;
		if (input.docReportFollowUpDate === undefined && input.docReportFollowUp === undefined) {
			delete updateData.docReportFollowUpDate;
			delete updateData.docReportFollowUp;
		}

		const result = await this.doctorReportModel
			.findOneAndUpdate({ _id: input.reportId, doctorId }, { $set: updateData }, { new: true, runValidators: true })
			.exec();
		if (!result) throw new InternalServerErrorException('Doctor report update failed');
		return result;
	}

	public async getMyDoctorReports(doctorId: ObjectId, input: DoctorReportInquiry): Promise<DoctorReports> {
		return await this.getReports({ doctorId }, input);
	}

	public async getMyDoctorReport(doctorId: ObjectId, reportId: ObjectId): Promise<DoctorReport> {
		const result = await this.doctorReportModel.findOne({ _id: reportId, doctorId }).exec();
		if (!result) throw new InternalServerErrorException('Doctor report was not found');
		return result;
	}

	public async getMyPatientReports(memberId: ObjectId, input: DoctorReportInquiry): Promise<DoctorReports> {
		const patientId = await this.patientService.resolveProfileId(memberId);
		return await this.getReports({ patientId }, input);
	}

	public async getMyPatientReport(memberId: ObjectId, reportId: ObjectId): Promise<DoctorReport> {
		const patientId = await this.patientService.resolveProfileId(memberId);
		const result = await this.doctorReportModel.findOne({ _id: reportId, patientId }).exec();
		if (!result) throw new InternalServerErrorException('Doctor report was not found');
		return result;
	}

	private async getReports(match: Record<string, unknown>, input: DoctorReportInquiry): Promise<DoctorReports> {
		const result = await this.doctorReportModel
			.aggregate([
				{ $match: match },
				{ $sort: { createdAt: -1 } },
				{
					$facet: {
						list: [{ $skip: (input.page - 1) * input.limit }, { $limit: input.limit }],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		return result[0] ?? { list: [], metaCounter: [] };
	}

	private validateFollowUp(followUp: DoctorReportFollowUp, followUpDate?: Date): void {
		if (followUp === DoctorReportFollowUp.REQUIRED && !followUpDate) {
			throw new BadRequestException('Follow-up date is required for this report');
		}
		if (followUpDate && Number.isNaN(new Date(followUpDate).getTime())) {
			throw new BadRequestException('Follow-up date must be valid');
		}
	}
}

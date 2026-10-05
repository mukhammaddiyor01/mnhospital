import { Types } from 'mongoose';
import { DoctorReportFollowUp } from './enums/doctor-report.enum';
import { DoctorReportsService } from './doctorReports.service';

describe('Doctor report notification triggers', () => {
	const doctorId = new Types.ObjectId();
	const patientId = new Types.ObjectId();
	const appointmentId = new Types.ObjectId();
	const reportId = new Types.ObjectId();
	const updatedAt = new Date('2026-11-01T10:00:00.000Z');
	const report = { _id: reportId, patientId, doctorId, updatedAt, docReportFollowUp: DoctorReportFollowUp.NONE };
	const doctorReportModel = { findOne: jest.fn(), create: jest.fn(), findOneAndUpdate: jest.fn() };
	const appointmentModel = { findOne: jest.fn() };
	const notificationEvents = { toPatient: jest.fn() };
	const service = new DoctorReportsService(doctorReportModel as never, appointmentModel as never, {} as never, notificationEvents as never);

	beforeEach(() => jest.clearAllMocks());

	it('notifies the patient after their doctor creates a report', async () => {
		appointmentModel.findOne.mockReturnValue({ lean: () => ({ exec: async () => ({ _id: appointmentId, patientId, serviceId: new Types.ObjectId() }) }) });
		doctorReportModel.findOne.mockReturnValue({ lean: () => ({ exec: async () => null }) });
		doctorReportModel.create.mockResolvedValue(report);
		await service.createReport(doctorId, { appointmentId, docReportFollowUp: DoctorReportFollowUp.NONE } as never);
		expect(notificationEvents.toPatient).toHaveBeenCalledWith(patientId, expect.objectContaining({ key: `report:${reportId}:created`, refId: reportId }));
	});

	it('notifies the patient using the saved report revision after an update', async () => {
		doctorReportModel.findOne.mockReturnValue({ exec: async () => report });
		doctorReportModel.findOneAndUpdate.mockReturnValue({ exec: async () => report });
		await service.updateReport(doctorId, { reportId, docReportRecommendation: 'Updated advice' } as never);
		expect(notificationEvents.toPatient).toHaveBeenCalledWith(patientId, expect.objectContaining({ key: `report:${reportId}:updated:${updatedAt.toISOString()}` }));
	});

	it('does not notify when the doctor does not own the report', async () => {
		doctorReportModel.findOne.mockReturnValue({ exec: async () => null });
		await expect(service.updateReport(doctorId, { reportId } as never)).rejects.toThrow();
		expect(notificationEvents.toPatient).not.toHaveBeenCalled();
	});
});

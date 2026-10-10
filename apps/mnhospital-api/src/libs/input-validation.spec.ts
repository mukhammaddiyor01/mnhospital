import { Types } from 'mongoose';
import { DoctorReportInquiry } from '../components/doctor/doctor-reports/dto/doctor-report.input';
import { createInputValidationPipe } from './input-validation';

describe('Runtime input validation', () => {
	it('passes the transformed report appointment filter to Mongo aggregation', async () => {
		const id = new Types.ObjectId();
		const input = await createInputValidationPipe().transform(
			{ appointmentId: id.toHexString(), page: 1, limit: 20 },
			{ type: 'body', metatype: DoctorReportInquiry },
		);
		expect(input.appointmentId).toBeInstanceOf(Types.ObjectId);
		expect(input.appointmentId.equals(id)).toBe(true);
	});
	it('rejects an invalid appointment filter', async () => {
		await expect(
			createInputValidationPipe().transform(
				{ appointmentId: 'invalid', page: 1, limit: 20 },
				{ type: 'body', metatype: DoctorReportInquiry },
			),
		).rejects.toThrow();
	});
	it('leaves GraphQL upload promises untouched', async () => {
		const upload = Promise.resolve({ createReadStream: () => undefined });
		const result = await createInputValidationPipe().transform(upload, { type: 'body', metatype: Object });
		expect(result.createReadStream).toBeDefined();
	});
});

import { AiChatService } from './ai-chat.service';
import { HospitalAssistantStatus } from './dto/ai-chat';
import { AskHospitalAssistantInput } from './dto/ai-chat.input';
import { PreferenceLanguage } from '../preference/enums/preference.enum';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('Homepage hospital assistant', () => {
	const input = { text: 'What services do you offer?', language: PreferenceLanguage.EN };
	let provider: any;
	let services: any;
	let doctors: any;
	let assistant: AiChatService;
	beforeEach(() => {
		provider = { isConfigured: jest.fn(() => true), reply: jest.fn().mockResolvedValue('Please view Services.') };
		services = {
			getServices: jest
				.fn()
				.mockResolvedValue({
					list: [
						{
							serviceName: 'Consultation',
							serviceType: 'CHECKUP',
							servicePrice: 20,
							serviceDuration: '30 min',
							memberData: { docPhone: 'PRIVATE_PHONE' },
							internal: 'PRIVATE_FIELD',
						},
					],
				}),
		};
		doctors = {
			getDoctors: jest
				.fn()
				.mockResolvedValue({
					list: [
						{
							docFullName: 'Dr Kim',
							docSpecialty: 'GENERAL',
							docExperience: 5,
							docPassword: 'PRIVATE_PASSWORD',
							docMail: 'PRIVATE_EMAIL',
						},
					],
				}),
		};
		assistant = new AiChatService(provider, services, doctors);
	});

	it('does not query or spend provider requests before configuration', async () => {
		provider.isConfigured.mockReturnValue(false);
		expect(await assistant.ask(input, '127.0.0.1')).toEqual({ status: HospitalAssistantStatus.NOT_CONFIGURED });
		expect(services.getServices).not.toHaveBeenCalled();
		expect(provider.reply).not.toHaveBeenCalled();
	});

	it('projects public fields, uses existing public queries and requests the selected language', async () => {
		expect((await assistant.ask({ ...input, language: PreferenceLanguage.KR }, '127.0.0.1')).status).toBe(
			HospitalAssistantStatus.READY,
		);
		expect(services.getServices).toHaveBeenCalledWith(null, { page: 1, limit: 20, search: {} });
		expect(doctors.getDoctors).toHaveBeenCalledWith({ page: 1, limit: 20, search: {} });
		const [instructions, question] = provider.reply.mock.calls[0];
		expect(instructions).toContain('Korean');
		expect(instructions).toContain('Dr Kim');
		expect(instructions).toContain('Consultation');
		expect(instructions).not.toContain('PRIVATE_');
		expect(question).toBe(input.text);
	});

	it('hides provider errors and can answer again after a failed request', async () => {
		provider.reply.mockRejectedValueOnce(new Error('secret key and raw prompt'));
		expect(await assistant.ask(input, '127.0.0.1')).toEqual({ status: HospitalAssistantStatus.UNAVAILABLE });
		expect((await assistant.ask(input, '127.0.0.1')).status).toBe(HospitalAssistantStatus.READY);
	});

	it('limits each address and resets the minute window', async () => {
		const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
		try {
			for (let i = 0; i < 6; i++) await assistant.ask(input, '127.0.0.1');
			expect(await assistant.ask(input, '127.0.0.1')).toEqual({ status: HospitalAssistantStatus.RATE_LIMITED });
			expect(provider.reply).toHaveBeenCalledTimes(6);
			clock.mockReturnValue(62000);
			expect((await assistant.ask(input, '127.0.0.1')).status).toBe(HospitalAssistantStatus.READY);
		} finally {
			clock.mockRestore();
		}
	});

	it('caps concurrent external calls', async () => {
		let release: () => void;
		provider.reply.mockReturnValue(
			new Promise<string>((resolve) => {
				release = () => resolve('Answer');
			}),
		);
		const pending = Array.from({ length: 4 }, (_, i) => assistant.ask(input, `address-${i}`));
		expect(await assistant.ask(input, 'other-address')).toEqual({ status: HospitalAssistantStatus.RATE_LIMITED });
		await Promise.resolve();
		await Promise.resolve();
		release!();
		await Promise.all(pending);
	});

	it('validates trimmed questions and rejects blank, oversized or invalid language input', async () => {
		const valid = plainToInstance(AskHospitalAssistantInput, { ...input, text: '  Hello  ' });
		expect(valid.text).toBe('Hello');
		expect(await validate(valid)).toHaveLength(0);
		for (const invalid of [
			{ ...input, text: ' ' },
			{ ...input, text: 'x'.repeat(1001) },
			{ ...input, language: 'BAD' },
		]) {
			expect((await validate(plainToInstance(AskHospitalAssistantInput, invalid))).length).toBeGreaterThan(0);
		}
	});
});

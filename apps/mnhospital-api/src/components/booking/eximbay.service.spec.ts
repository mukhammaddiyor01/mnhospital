import { ConfigService } from '@nestjs/config';
import { EximbayService } from './eximbay.service';

describe('Eximbay checkout preparation', () => {
	const values = { EXIMBAY_API_KEY: 'test_fixture-key', EXIMBAY_MID: 'fixture-mid', BASE_URL: 'http://localhost:2001' };
	const input = { paymentId: 'payment-fixture', providerPaymentId: 'order-fixture', currency: 'KRW', amount: 70000, buyerName: 'Fixture Buyer', buyerEmail: 'fixture@example.com' };
	let fetchMock: jest.SpyInstance;
	let service: EximbayService;
	beforeEach(() => {
		service = new EximbayService({ get: (key: string) => values[key] } as unknown as ConfigService);
		fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ rescode: '0000', fgkey: 'fixture-fgkey' }) } as Response);
	});
	afterEach(() => fetchMock.mockRestore());

	it('prepares the same redirect parameters used by the client SDK', async () => {
		const result = await service.prepare(input);
		const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(fetchMock.mock.calls[0][0]).toBe('https://api-test.eximbay.com/v1/payments/ready');
		expect(result.payment).toEqual(payload.payment);
		expect(result.payment).toMatchObject({ order_id: input.providerPaymentId, currency: 'KRW', amount: '70000' });
		expect(result.settings).toEqual({ display_type: 'R' });
		expect(result.settings).toEqual(payload.settings);
		expect(result.url.return_url).toBe('http://localhost:2001/api/booking/payment/eximbay/return/payment-fixture');
		expect(result).not.toHaveProperty('apiKey');
		expect(service.getClientUrl()).toBe('http://localhost:2002');
	});

	it('rejects zero or invalid amounts before calling the gateway', async () => {
		for (const amount of [0, -1, Number.NaN]) await expect(service.prepare({ ...input, amount })).rejects.toThrow('greater than zero');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('does not open checkout when gateway preparation fails', async () => {
		fetchMock.mockResolvedValue({ ok: true, json: async () => ({ rescode: '1000', resmsg: 'Invalid test payment' }) } as Response);
		await expect(service.prepare(input)).rejects.toThrow('Invalid test payment');
	});

	it('requires merchant configuration before gateway preparation', async () => {
		service = new EximbayService({ get: () => undefined } as unknown as ConfigService);
		await expect(service.prepare(input)).rejects.toThrow('configuration is incomplete');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it.each([
		{ EXIMBAY_API_BASE: 'https://api.eximbay.com' },
		{ EXIMBAY_API_BASE: 'https://api-test.eximbay.com.example.com' },
		{ EXIMBAY_API_BASE: 'http://api-test.eximbay.com' },
		{ EXIMBAY_API_KEY: 'live_fixture-key' },
	])('blocks non-sandbox configuration for every gateway operation: %j', async (override) => {
		const config = { ...values, ...override };
		service = new EximbayService({ get: (key: string) => config[key] } as unknown as ConfigService);
		await expect(service.prepare(input)).rejects.toThrow('restricted to sandbox');
		await expect(service.verify('fixture')).rejects.toThrow('restricted to sandbox');
		await expect(service.retrieve({ ...input, transactionId: 'fixture' })).rejects.toThrow('restricted to sandbox');
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

import {
	BadRequestException,
	Injectable,
	InternalServerErrorException,
	Logger,
	ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface EximbayReadyPayload {
	payment: {
		transaction_type: string;
		order_id: string;
		currency: string;
		amount: string;
		lang: string;
	};
	merchant: { mid: string };
	buyer: { name: string; email: string };
	url: { return_url: string; status_url: string };
	settings: { display_type: 'R' };
}

@Injectable()
export class EximbayService {
	private readonly logger = new Logger(EximbayService.name);
	constructor(private readonly configService: ConfigService) {}

	private async gatewayRequest<T>(operation: 'ready' | 'verify' | 'retrieve', body: unknown): Promise<T> {
		const config = this.getConfig();
		const unavailable = () =>
			new ServiceUnavailableException(
				'Online card payments are temporarily unavailable. Please try again later or pay at reception.',
			);
		let response: Response;
		let data: { rescode?: string; code?: string };
		try {
			response = await fetch(`${config.baseUrl}/v1/payments/${operation}`, {
				method: 'POST',
				headers: this.getHeaders(config.apiKey),
				signal: AbortSignal.timeout(15000),
				body: JSON.stringify(body),
			});
			data = await response.json();
		} catch {
			this.logger.warn(`Eximbay ${operation}: gateway connection or response failed`);
			throw unavailable();
		}
		if (!data || !response.ok || data.rescode !== '0000') {
			const rawCode = data?.code ?? data?.rescode;
			const code =
				typeof rawCode === 'string' && /^[A-Z0-9_]{2,16}$/.test(rawCode) ? rawCode : `HTTP_${response.status}`;
			this.logger.warn(`Eximbay ${operation}: rejected (${code})`);
			if (operation === 'verify' && code !== 'EC1000')
				throw new BadRequestException('The payment result could not be verified');
			throw unavailable();
		}
		return data as T;
	}

	public getTestMode(): 'SIMULATED' | 'SANDBOX' | 'DISABLED' {
		const mode = this.configService.get<string>('EXIMBAY_TEST_MODE');
		if (mode === 'disabled') return 'DISABLED';
		if (mode === 'simulated')
			return (this.configService.get<string>('NODE_ENV') ?? process.env.NODE_ENV) === 'production'
				? 'DISABLED'
				: 'SIMULATED';
		try {
			this.getConfig();
			return 'SANDBOX';
		} catch {
			return 'DISABLED';
		}
	}

	private getConfig() {
		const baseUrl = this.configService.get<string>('EXIMBAY_API_BASE') ?? 'https://api-test.eximbay.com';
		const apiKey = this.configService.get<string>('EXIMBAY_API_KEY');
		const mid = this.configService.get<string>('EXIMBAY_MID');
		const serverUrl = this.configService.get<string>('BASE_URL') ?? 'http://localhost:2001';
		const clientUrl = this.configService.get<string>('CLIENT_URL') ?? 'http://localhost:2002';

		if (!apiKey || !mid) {
			throw new InternalServerErrorException('Eximbay configuration is incomplete');
		}
		if (baseUrl.replace(/\/$/, '') !== 'https://api-test.eximbay.com' || !apiKey.startsWith('test_')) {
			throw new InternalServerErrorException('Eximbay is restricted to sandbox test payments');
		}

		return {
			baseUrl: baseUrl.replace(/\/$/, ''),
			apiKey,
			mid,
			serverUrl: serverUrl.replace(/\/$/, ''),
			clientUrl: clientUrl.replace(/\/$/, ''),
		};
	}

	private getHeaders(apiKey: string): HeadersInit {
		return {
			Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
			'Content-Type': 'application/json',
		};
	}

	public getClientUrl(): string {
		return (this.configService.get<string>('CLIENT_URL') ?? 'http://localhost:2002').replace(/\/$/, '');
	}

	public async prepare(input: {
		paymentId: string;
		providerPaymentId: string;
		currency: string;
		amount: number;
		buyerName?: string;
		buyerEmail?: string;
	}): Promise<{
		fgkey: string;
		mid: string;
		payment: EximbayReadyPayload['payment'];
		merchant: EximbayReadyPayload['merchant'];
		buyer: EximbayReadyPayload['buyer'];
		url: EximbayReadyPayload['url'];
		settings: EximbayReadyPayload['settings'];
	}> {
		if (!Number.isFinite(input.amount) || input.amount <= 0) {
			throw new BadRequestException('Eximbay payment amount must be greater than zero');
		}
		if (input.currency === 'UZS') throw new BadRequestException('This Eximbay sandbox merchant requires KRW checkout');
		const config = this.getConfig();
		const payload: EximbayReadyPayload = {
			payment: {
				transaction_type: 'PAYMENT',
				order_id: input.providerPaymentId,
				currency: input.currency,
				amount: String(input.amount),
				lang: 'EN',
			},
			merchant: { mid: config.mid },
			buyer: {
				name: input.buyerName || 'Patient',
				email: input.buyerEmail || 'test@example.com',
			},
			url: {
				return_url: `${config.serverUrl}/api/booking/payment/eximbay/return/${input.paymentId}`,
				status_url: `${config.serverUrl}/api/booking/payment/eximbay/status/${input.paymentId}`,
			},
			settings: { display_type: 'R' },
		};

		const data = await this.gatewayRequest<{ fgkey?: string }>('ready', payload);
		if (!data.fgkey)
			throw new ServiceUnavailableException('The payment window is unavailable. Please try again later.');

		return {
			fgkey: data.fgkey,
			mid: config.mid,
			payment: payload.payment,
			merchant: payload.merchant,
			buyer: payload.buyer,
			url: payload.url,
			settings: payload.settings,
		};
	}

	public async verify(rawData: string): Promise<void> {
		await this.gatewayRequest('verify', { data: rawData });
	}

	public async retrieve(input: { providerPaymentId: string; currency: string; amount: number; transactionId: string }) {
		const config = this.getConfig();
		const data = await this.gatewayRequest<{
			payment?: { order_id?: string; amount?: string; transaction_id?: string; currency?: string; status?: string };
		}>('retrieve', {
			mid: config.mid,
			key_field: 'transaction_id',
			payment: {
				order_id: input.providerPaymentId,
				currency: input.currency,
				amount: String(input.amount),
				transaction_id: input.transactionId,
				lang: 'EN',
			},
		});

		return data;
	}
}

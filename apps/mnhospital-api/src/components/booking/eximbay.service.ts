import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
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
}

@Injectable()
export class EximbayService {
	constructor(private readonly configService: ConfigService) {}

	private getConfig() {
		const baseUrl = this.configService.get<string>('EXIMBAY_API_BASE') ?? 'https://api-test.eximbay.com';
		const apiKey = this.configService.get<string>('EXIMBAY_API_KEY');
		const mid = this.configService.get<string>('EXIMBAY_MID');
		const serverUrl = this.configService.get<string>('BASE_URL') ?? 'http://localhost:2001';
		const clientUrl = this.configService.get<string>('CLIENT_URL') ?? 'http://localhost:3000';

		if (!apiKey || !mid) {
			throw new InternalServerErrorException('Eximbay configuration is incomplete');
		}

		return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey, mid, serverUrl: serverUrl.replace(/\/$/, ''), clientUrl: clientUrl.replace(/\/$/, '') };
	}

	private getHeaders(apiKey: string): HeadersInit {
		return {
			Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
			'Content-Type': 'application/json',
		};
	}

	public getClientUrl(): string {
		return this.getConfig().clientUrl;
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
	}> {
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
		};

		const response = await fetch(`${config.baseUrl}/v1/payments/ready`, {
			method: 'POST',
			headers: this.getHeaders(config.apiKey),
			body: JSON.stringify(payload),
		});
		const data = (await response.json()) as { rescode?: string; resmsg?: string; fgkey?: string };

		if (!response.ok || data.rescode !== '0000' || !data.fgkey) {
			throw new InternalServerErrorException(`Eximbay ready failed: ${data.resmsg || response.statusText}`);
		}

		return {
			fgkey: data.fgkey,
			mid: config.mid,
			payment: payload.payment,
			merchant: payload.merchant,
			buyer: payload.buyer,
			url: payload.url,
		};
	}

	public async verify(rawData: string): Promise<void> {
		const config = this.getConfig();
		const response = await fetch(`${config.baseUrl}/v1/payments/verify`, {
			method: 'POST',
			headers: this.getHeaders(config.apiKey),
			body: JSON.stringify({ data: rawData }),
		});
		const data = (await response.json()) as { rescode?: string; resmsg?: string };

		if (!response.ok || data.rescode !== '0000') {
			throw new BadRequestException(`Eximbay verify failed: ${data.resmsg || response.statusText}`);
		}
	}

	public async retrieve(input: {
		providerPaymentId: string;
		currency: string;
		amount: number;
		transactionId: string;
	}) {
		const config = this.getConfig();
		const response = await fetch(`${config.baseUrl}/v1/payments/retrieve`, {
			method: 'POST',
			headers: this.getHeaders(config.apiKey),
			body: JSON.stringify({
				mid: config.mid,
				key_field: 'transaction_id',
				payment: {
					order_id: input.providerPaymentId,
					currency: input.currency,
					amount: String(input.amount),
					transaction_id: input.transactionId,
					lang: 'EN',
				},
			}),
		});
		const data = (await response.json()) as {
			rescode?: string;
			resmsg?: string;
			payment?: { order_id?: string; amount?: string; transaction_id?: string };
		};

		if (!response.ok || data.rescode !== '0000') {
			throw new BadRequestException(`Eximbay retrieve failed: ${data.resmsg || response.statusText}`);
		}

		return data;
	}
}

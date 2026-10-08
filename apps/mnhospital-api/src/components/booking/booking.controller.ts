import { All, Controller, Param, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { BookingService } from './booking.service';
import { EximbayService } from './eximbay.service';

@Controller('api/booking/payment/eximbay')
export class BookingController {
	constructor(
		private readonly bookingService: BookingService,
		private readonly eximbayService: EximbayService,
	) {}

	@All('return/:paymentId')
	public async handleReturn(
		@Param('paymentId') paymentId: string,
		@Req() request: Request,
		@Res() response: Response,
	): Promise<void> {
		const clientUrl = this.eximbayService.getClientUrl();
		try {
			await this.bookingService.verifyEximbayPayment(new ObjectId(paymentId), this.toRawData(request));
			const succeeded = new URLSearchParams(this.toRawData(request)).get('rescode') === '0000';
			response.redirect(`${clientUrl}/booking/payment/${paymentId}/${succeeded ? 'success' : 'failed'}`);
		} catch (error) {
			console.warn('[eximbay/return] Payment verification failed');
			response.redirect(`${clientUrl}/booking/payment/${paymentId}/failed`);
		}
	}

	@Post('status/:paymentId')
	public async handleStatus(
		@Param('paymentId') paymentId: string,
		@Req() request: Request,
		@Res() response: Response,
	): Promise<void> {
		try {
			await this.bookingService.verifyEximbayPayment(new ObjectId(paymentId), this.toRawData(request));
		} catch (error) {
			console.warn('[eximbay/status] Payment verification failed');
			response.status(400).send('verification failed');
			return;
		}
		response.status(200).send('ok');
	}

	private toRawData(request: Request): string {
		const params = new URLSearchParams();
		const values = {
			...(request.query as Record<string, unknown>),
			...(typeof request.body === 'string' ? {} : (request.body as Record<string, unknown>)),
		};

		for (const [key, value] of Object.entries(values)) {
			if (value === undefined || value === null) continue;
			if (Array.isArray(value)) value.forEach((item) => params.append(key, String(item)));
			else params.set(key, String(value));
		}

		if (typeof request.body === 'string' && request.body) return request.body;
		return params.toString();
	}
}

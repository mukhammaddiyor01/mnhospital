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
			response.redirect(`${clientUrl}/booking/payment/${paymentId}/success`);
		} catch (error) {
			console.error('[eximbay/return]', error);
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
			console.error('[eximbay/status]', error);
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

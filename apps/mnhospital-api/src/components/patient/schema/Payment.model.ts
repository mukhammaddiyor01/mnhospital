import { Schema } from 'mongoose';
import { PaymentMethod, PaymentProvider, PaymentStatus } from '../enums/patient.enum';

const PaymentSchema = new Schema(
	{
		activeIntent: { type: Boolean, default: true },
		testPayment: { type: Boolean, default: false },
		serviceId: {
			type: Schema.Types.ObjectId,
			ref: 'Service',
			required: true,
		},
		patientId: {
			type: Schema.Types.ObjectId,
			ref: 'Patient',
			required: true,
			index: true,
		},
		doctorId: {
			type: Schema.Types.ObjectId,
			ref: 'Doctor',
			required: true,
		},
		providerPaymentId: {
			type: String,
			required: true,
			unique: true,
		},
		gatewayTransactionId: {
			type: String,
			index: true,
		},
		bookingOrderId: {
			type: Schema.Types.ObjectId,
			ref: 'BookingOrder',
			required: true,
			index: true,
		},
		paymentProvider: {
			type: String,
			enum: PaymentProvider,
			required: true,
		},
		idempotencyKey: {
			type: String,
			required: true,
			unique: true,
		},
		paymentAmount: {
			type: Number,
			required: true,
			min: 0,
		},
		paymentCurrency: {
			type: String,
			required: true,
			uppercase: true,
		},
		paymentMethod: {
			type: String,
			enum: PaymentMethod,
			required: true,
		},
		paymentStatus: {
			type: String,
			enum: PaymentStatus,
			default: PaymentStatus.PENDING,
		},
		paidAt: {
			type: Date,
		},
		refundedAt: {
			type: Date,
		},
	},
	{ timestamps: true, collection: 'payment' },
);

PaymentSchema.index({ bookingOrderId: 1, serviceId: 1, doctorId: 1 }, { unique: true, partialFilterExpression: { activeIntent: true } });

export default PaymentSchema;

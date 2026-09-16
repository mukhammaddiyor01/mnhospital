import { Schema } from 'mongoose';
import { BookingOrderStatus } from '../enums/patient.enum';

const BookingOrderItemSchema = new Schema(
	{
		serviceId: {
			type: String,
			required: true,
		},
		doctorId: {
			type: String,
			required: true,
		},
		serviceName: {
			type: String,
			required: true,
		},
		servicePrice: {
			type: String,
			required: true,
		},
		serviceDuration: {
			type: String,
			required: true,
		},
		requestedStartAt: {
			type: String,
			required: true,
		},
		appointmentId: {
			type: String,
		},
	},
	{ _id: false },
);

const BookingOrderSchema = new Schema(
	{
		patientId: {
			type: Schema.Types.ObjectId,
			ref: 'Patient',
			required: true,
			index: true,
		},
		cartId: {
			type: Schema.Types.ObjectId,
			ref: 'Cart',
			required: true,
		},
		orderCode: {
			type: String,
			required: true,
			unique: true,
		},
		bookingOrderStatus: {
			type: String,
			enum: BookingOrderStatus,
			default: BookingOrderStatus.PENDING,
		},
		bookingOrderCurrency: {
			type: String,
			required: true,
			uppercase: true,
		},
		bookingOrderItems: {
			type: [BookingOrderItemSchema],
			required: true,
			default: [],
		},
		bookingOrderSubtotalAmount: {
			type: Number,
			required: true,
			min: 0,
		},
		bookingOrderDiscountAmount: {
			type: Number,
			required: true,
			min: 0,
		},
		bookingOrderTotalAmount: {
			type: Number,
			required: true,
			min: 0,
		},
		confirmedAt: {
			type: Date,
		},
		cancelledAt: {
			type: Date,
		},
	},
	{ timestamps: true, collection: 'bookingOrder' },
);

export default BookingOrderSchema;

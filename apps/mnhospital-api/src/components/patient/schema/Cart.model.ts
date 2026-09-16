import { Schema } from 'mongoose';
import { CartStatus } from '../enums/patient.enum';

const CartSchema = new Schema(
	{
		patientId: {
			type: Schema.Types.ObjectId,
			ref: 'Patient',
			required: true,
			index: true,
		},
		cartStatus: {
			type: String,
			enum: CartStatus,
			default: CartStatus.ACTIVE,
		},
		currency: {
			type: String,
			required: true,
			uppercase: true,
			default: 'UZS',
		},
		subtotalAmount: {
			type: Number,
			required: true,
			min: 0,
			default: 0,
		},
		discountAmount: {
			type: Number,
			required: true,
			min: 0,
			default: 0,
		},
		totalAmount: {
			type: Number,
			required: true,
			min: 0,
			default: 0,
		},
		expiresAt: {
			type: Date,
		},
	},
	{ timestamps: true, collection: 'cart' },
);

CartSchema.index({ patientId: 1, cartStatus: 1 });

export default CartSchema;

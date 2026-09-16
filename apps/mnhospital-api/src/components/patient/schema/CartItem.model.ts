import { Schema } from 'mongoose';
import { ServiceType } from '../../service/enums/service.enum';

const CartItemSchema = new Schema(
	{
		cartId: {
			type: Schema.Types.ObjectId,
			ref: 'Cart',
			required: true,
			index: true,
		},
		serviceId: {
			type: Schema.Types.ObjectId,
			ref: 'Service',
			required: true,
		},
		doctorId: {
			type: Schema.Types.ObjectId,
			ref: 'Doctor',
			required: true,
		},
		serviceType: {
			type: String,
			enum: ServiceType,
			required: true,
		},
		serviceName: {
			type: String,
			required: true,
		},
		servicePrice: {
			type: Number,
			required: true,
			min: 0,
		},
		serviceDuration: {
			type: Number,
			required: true,
			min: 1,
		},
		patientNote: {
			type: String,
		},
		requestedStartAt: {
			type: Date,
			required: true,
		},
	},
	{ timestamps: { createdAt: 'addedAt', updatedAt: true }, collection: 'cartItem' },
);

CartItemSchema.index({ cartId: 1, serviceId: 1, doctorId: 1 });

export default CartItemSchema;

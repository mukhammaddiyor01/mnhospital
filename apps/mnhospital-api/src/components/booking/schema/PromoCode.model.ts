import { Schema } from 'mongoose';
export default new Schema(
	{
		code: { type: String, required: true, unique: true, uppercase: true, trim: true },
		discountType: { type: String, enum: ['PERCENT', 'FIXED'], required: true },
		discountValue: { type: Number, required: true, min: 0.01 },
		currency: { type: String, required: true },
		isActive: { type: Boolean, default: true },
		showOnHomepage: { type: Boolean, default: false },
		minSubtotal: { type: Number, default: 0, min: 0 },
		serviceIds: { type: [String], default: [] },
		startsAt: Date,
		expiresAt: Date,
		deletedAt: Date,
		createdBy: { type: Schema.Types.ObjectId, required: true },
		updatedBy: Schema.Types.ObjectId,
	},
	{ timestamps: true, collection: 'promoCodes' },
);

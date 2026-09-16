import { Schema } from 'mongoose';

const RefreshTokenSchema = new Schema(
	{
		memberId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
			index: true,
		},
		tokenHash: {
			type: String,
			required: true,
			unique: true,
			select: false,
		},
		expiresAt: {
			type: Date,
			required: true,
			index: { expires: 0 },
		},
		revokedAt: {
			type: Date,
		},
	},
	{ timestamps: { createdAt: true, updatedAt: false }, collection: 'refreshToken' },
);

export default RefreshTokenSchema;

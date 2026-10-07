import { Schema } from 'mongoose';
import { MemberType } from '../enums/member.enum';

// One document is one login session. Rotation consumes hashes atomically.
const RefreshTokenSchema = new Schema(
	{
		ownerId: { type: Schema.Types.ObjectId, required: true },
		ownerType: { type: String, enum: MemberType, required: true },
		profileVersion: { type: Number, default: 0 },
		tokenHash: { type: String, required: true, select: false },
		usedTokenHashes: { type: [String], default: [], select: false },
		expiresAt: { type: Date, required: true, index: { expires: 0 } },
		revokedAt: { type: Date },
	},
	{ timestamps: true, collection: 'refreshToken' },
);
RefreshTokenSchema.index({ ownerId: 1, ownerType: 1, revokedAt: 1 });
export default RefreshTokenSchema;

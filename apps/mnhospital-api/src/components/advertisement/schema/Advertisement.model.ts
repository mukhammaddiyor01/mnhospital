import { Schema } from 'mongoose';
import { AdvertisementStatus } from '../enums/advertisement.enum';

const AdvertisementSchema = new Schema(
	{
		createdByMemberId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
			index: true,
		},
		advertisementStatus: {
			type: String,
			enum: AdvertisementStatus,
			default: AdvertisementStatus.DRAFT,
			index: true,
		},
		advertisementTitle: {
			type: String,
			required: true,
			trim: true,
		},
		advertisementContent: {
			type: String,
			required: true,
		},
		advertisementImage: {
			type: String,
		},
		advertisementLink: {
			type: String,
		},
	},
	{ timestamps: true, collection: 'advertisements' },
);

export default AdvertisementSchema;

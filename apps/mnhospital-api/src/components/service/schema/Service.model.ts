import { Schema } from 'mongoose';
import { ServiceRoom, ServiceRoomName, ServiceStatus, ServiceType } from '../enums/service.enum';

const ServiceSchema = new Schema(
	{
		memberId: {
			type: Schema.Types.ObjectId,
			ref: 'Doctor',
			required: true,
			index: true,
		},
		departmentId: {
			type: Schema.Types.ObjectId,
			ref: 'Department',
			required: true,
			index: true,
		},
		serviceType: {
			type: String,
			enum: ServiceType,
			required: true,
		},
		serviceName: {
			type: String,
			required: true,
			trim: true,
			index: true,
		},
		serviceStatus: {
			type: String,
			enum: ServiceStatus,
			default: ServiceStatus.ACTIVE,
		},
		serviceRoomName: {
			type: String,
			enum: ServiceRoomName,
			required: true,
		},
		serviceRoom: {
			type: String,
			enum: ServiceRoom,
			required: true,
		},
		serviceTitle: {
			type: String,
			required: true,
		},
		servicePrice: {
			type: Number,
			required: true,
		},
		serviceDiscountPercent: { type: Number, default: 0, min: 0, max: 100 },
		serviceLikes: {
			type: Number,
			default: 0,
		},
		serviceViews: {
			type: Number,
			default: 0,
		},
		serviceRank: {
			type: Number,
			default: 0,
		},
		serviceComments: {
			type: Number,
			default: 0,
		},
		serviceImages: {
			type: [String],
			required: true,
			default: [],
		},
		serviceDesc: {
			type: String,
			required: true,
		},
		serviceDuration: {
			type: String,
			required: true,
		},
		availabilityDates: { type: [String], default: [] },
		openedAt: {
			type: Date,
		},
		closedAt: {
			type: Date,
		},
		deletedAt: {
			type: Date,
		},
		inactiveAt: {
			type: Date,
		},
		unavailabeAt: {
			type: Date,
		},
	},
	{ timestamps: true, collection: 'services' },
);

ServiceSchema.index({ memberId: 1, serviceType: 1 });

export default ServiceSchema;

import { Schema } from 'mongoose';
import { ReferenceGroup } from '../../../libs/enums/reference.enum';
import { CommentStatus } from '../enums/comment.enum';

const CommentSchema = new Schema(
	{
		commentStatus: {
			type: String,
			enum: CommentStatus,
			default: CommentStatus.ACTIVE,
		},
		commentGroup: {
			type: String,
			enum: ReferenceGroup,
			required: true,
		},
		commentContent: {
			type: String,
			required: true,
		},
		commentRefId: {
			type: Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		memberId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
			index: true,
		},
	},
	{ timestamps: true, collection: 'comments' },
);

CommentSchema.index({ commentRefId: 1, createdAt: -1 });

export default CommentSchema;

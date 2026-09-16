import { Schema } from 'mongoose';
import { ArticleCategory, ArticleStatus } from '../enums/article.enum';

const ArticleSchema = new Schema(
	{
		memberId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
			index: true,
		},
		articleCategory: {
			type: String,
			enum: ArticleCategory,
			required: true,
			index: true,
		},
		articleStatus: {
			type: String,
			enum: ArticleStatus,
			default: ArticleStatus.DRAFT,
			index: true,
		},
		articleTitle: {
			type: String,
			required: true,
			trim: true,
		},
		articleContent: {
			type: String,
			required: true,
		},
		articleImage: {
			type: String,
		},
		articleLikes: {
			type: Number,
			default: 0,
		},
		articleViews: {
			type: Number,
			default: 0,
		},
		articleComments: {
			type: Number,
			default: 0,
		},
	},
	{ timestamps: true, collection: 'articles' },
);

export default ArticleSchema;

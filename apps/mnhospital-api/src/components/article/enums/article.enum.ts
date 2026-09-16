import { registerEnumType } from '@nestjs/graphql';

export enum ArticleCategory {
	HEALTH = 'HEALTH',
	NEWS = 'NEWS',
	TIPS = 'TIPS',
	RESEARCH = 'RESEARCH',
	ANNOUNCEMENT = 'ANNOUNCEMENT',
}
registerEnumType(ArticleCategory, { name: 'ArticleCategory' });

export enum ArticleStatus {
	DRAFT = 'DRAFT',
	PUBLISHED = 'PUBLISHED',
	ARCHIVED = 'ARCHIVED',
}
registerEnumType(ArticleStatus, { name: 'ArticleStatus' });

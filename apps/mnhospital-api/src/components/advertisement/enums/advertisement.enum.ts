import { registerEnumType } from '@nestjs/graphql';

export enum AdvertisementStatus {
	DRAFT = 'DRAFT',
	PUBLISHED = 'PUBLISHED',
	ARCHIVED = 'ARCHIVED',
}

registerEnumType(AdvertisementStatus, { name: 'AdvertisementStatus' });

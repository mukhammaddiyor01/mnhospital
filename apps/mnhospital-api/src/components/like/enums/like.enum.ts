import { registerEnumType } from '@nestjs/graphql';

export enum LikeAction {
	LIKE = 'LIKE',
	UNLIKE = 'UNLIKE',
}
registerEnumType(LikeAction, { name: 'LikeAction' });

export enum LikeGroup {
	MEMBER = 'MEMBER',
	DOCTOR = 'DOCTOR',
	SERVICE = 'SERVICE',
	ARTICLE = 'ARTICLE',
}

registerEnumType(LikeGroup, { name: 'LikeGroup' });

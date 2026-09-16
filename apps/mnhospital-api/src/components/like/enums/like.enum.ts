import { registerEnumType } from '@nestjs/graphql';

export enum LikeAction {
	LIKE = 'LIKE',
	UNLIKE = 'UNLIKE',
}
registerEnumType(LikeAction, { name: 'LikeAction' });

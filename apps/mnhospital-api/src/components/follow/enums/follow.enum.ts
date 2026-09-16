import { registerEnumType } from '@nestjs/graphql';

export enum FollowAction {
	FOLLOW = 'FOLLOW',
	UNFOLLOW = 'UNFOLLOW',
}
registerEnumType(FollowAction, { name: 'FollowAction' });

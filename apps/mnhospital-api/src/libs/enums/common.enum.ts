import { registerEnumType } from '@nestjs/graphql';

export enum Message {
	SOMETHING_WENT_WRONG = 'Something went wrong!',
	NO_DATA_FOUND = 'No data is found!',
	CREATE_FAILED = 'Create is failed!',
	UPDATE_FAILED = 'Update is failed!',
	REMOVE_FAILED = 'Remove failed!',
	BAD_REQUEST = 'Bad Request',
	SERVICE_TYPE_LIMIT_REACHED = 'You can create up to 4 services of the same type!',

	USED_MEMBER_NICK_OR_PHONE = 'Already used member nick or phone!',
	USED_DOCTOR_NICK_PHONE_OR_MAIL = 'Doctor nick, phone or email is already in use!',
	USED_NICK_PHONE = 'You are inserting already used nick or phone!',
	TOKEN_CREATION_FAILED = 'Token creation error!',
	NO_MEMBER_NICK = 'no member with that member nick!',
	NO_DOCTOR_NICK = 'No doctor with that doctor nick!',
	DOCTOR_SIGNUP_REQUIRED = 'Doctors must register through signupDoctor!',
	BLOCKED_USER = 'You have been blocked, contact MNHospital!',
	WRONG_PASSWORD = 'Wrong password entered, please try again!',
	NOT_AUTHENTICATED = 'You are not authenticated, Please login first!',
	TOKEN_NOT_EXIST = 'Bearer Token is not provided',
	ONLY_SPECIFIC_ROLES_ALLOWED = 'Allowed only for members with specific roles!',
	NOT_ALLOWED_REQUEST = 'Not Allowed Request!',
	PROVIDE_ALLOWED_FORMAT = 'Please provide jpg, jpeg or png images!',
	SELF_FOLLOW_DENIED = 'You cannot follow yourself!',
	UPLOAD_FAILED = 'UPLOAD_FAILED',
}

registerEnumType(Message, { name: 'Message' });

export enum Direction {
	ASC = 1,
	DESC = -1,
}

registerEnumType(Direction, {
	name: 'Direction',
});

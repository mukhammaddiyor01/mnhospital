import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Length, Min } from 'class-validator';
import { RoomStatus, RoomType } from '../../../libs/enums/appointment.enum';
@ObjectType()
export class HospitalRoom {
	@Field(() => String) _id: string;
	@Field(() => String) roomNumber: string;
	@Field(() => String, { nullable: true }) roomName?: string;
	@Field(() => RoomType) roomType: RoomType;
	@Field(() => RoomStatus) roomStatus: RoomStatus;
	@Field(() => Int, { nullable: true }) floor?: number;
}
@InputType()
export class HospitalRoomInput {
	@IsString() @IsNotEmpty() @Length(1, 30) @Field(() => String) roomNumber: string;
	@IsOptional() @IsString() @Length(1, 100) @Field(() => String, { nullable: true }) roomName?: string;
	@IsEnum(RoomType) @Field(() => RoomType) roomType: RoomType;
	@IsOptional() @IsEnum(RoomStatus) @Field(() => RoomStatus, { nullable: true }) roomStatus?: RoomStatus;
	@IsOptional() @IsInt() @Min(0) @Field(() => Int, { nullable: true }) floor?: number;
}

import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType } from '../member/enums/member.enum';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { HospitalRoom, HospitalRoomInput } from './dto/room';
import { RoomService } from './room.service';
@Resolver()
export class RoomResolver {
	constructor(private readonly rooms: RoomService) {}
	@Roles(MemberType.ADMIN, MemberType.PATIENT, MemberType.DOCTOR, MemberType.RECEPTIONIST)
	@UseGuards(RolesGuard)
	@Query(() => [HospitalRoom])
	public async getRooms(): Promise<HospitalRoom[]> {
		return this.rooms.getRooms();
	}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => HospitalRoom)
	public async createRoom(@Args('input') input: HospitalRoomInput): Promise<HospitalRoom> {
		return this.rooms.createRoom(input);
	}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => HospitalRoom)
	public async updateRoom(@Args('roomId') id: string, @Args('input') input: HospitalRoomInput): Promise<HospitalRoom> {
		return this.rooms.updateRoom(shapeIntoMongoObjectId(id), input);
	}
}

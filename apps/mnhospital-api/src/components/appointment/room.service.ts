import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HospitalRoom, HospitalRoomInput } from './dto/room';
@Injectable()
export class RoomService {
	constructor(@InjectModel('Room') private readonly rooms: Model<HospitalRoom>) {}
	public async getRooms(): Promise<HospitalRoom[]> {
		return this.rooms.find({}).sort({ roomNumber: 1 }).limit(100).lean().exec();
	}
	public async createRoom(input: HospitalRoomInput): Promise<HospitalRoom> {
		try {
			return await this.rooms.create(input);
		} catch (error) {
			if (error?.code === 11000) throw new BadRequestException('Room number already exists');
			throw new BadRequestException('Room could not be created');
		}
	}
	public async updateRoom(id: Types.ObjectId, input: HospitalRoomInput): Promise<HospitalRoom> {
		try {
			const room = await this.rooms
				.findOneAndUpdate({ _id: id }, { $set: input }, { new: true, runValidators: true })
				.exec();
			if (!room) throw new NotFoundException('Room was not found');
			return room;
		} catch (error) {
			if (error instanceof NotFoundException) throw error;
			if (error?.code === 11000) throw new BadRequestException('Room number already exists');
			throw new BadRequestException('Room could not be updated');
		}
	}
}

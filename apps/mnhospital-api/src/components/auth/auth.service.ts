import { Injectable } from '@nestjs/common';
import * as bycrypt from 'bcryptjs';
import { T } from '../../libs/types/common';
import { JwtService } from '@nestjs/jwt';
import { shapeIntoMongoObjectId } from '../../libs/config';

@Injectable()
export class AuthService {
	constructor(private jwtService: JwtService) {}

	public async hashPassword(memberPassword: string): Promise<string> {
		const salt = await bycrypt.genSalt();
		return await bycrypt.hash(memberPassword, salt);
	}

	public async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
		return await bycrypt.compare(password, hashedPassword);
	}

	public async createToken(member: T): Promise<string> {
		const payload: T = {};

		Object.keys(member['_doc'] ? member['_doc'] : member).map((ele) => {
			payload[`${ele}`] = member[`${ele}`];
		});
		delete payload.memberPassword;
		delete payload.docPassword;
		delete payload.patientPassword;
		delete payload.receptionistPassword;
		delete payload.adminPassword;

		return await this.jwtService.signAsync(payload);
	}

	public async verifyToken(token: string): Promise<T> {
		const member = await this.jwtService.verifyAsync(token);
		member._id = shapeIntoMongoObjectId(member._id);
		return member;
	}
}

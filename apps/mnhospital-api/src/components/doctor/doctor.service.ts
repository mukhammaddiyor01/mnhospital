import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Doctor, Doctors } from './dto/doctor';
import { DoctorInput, DoctorLoginInput, DoctorsInquiry } from './dto/doctor.input';
import { T } from '../../libs/types/common';
import { Direction, Message } from '../../libs/enums/common.enum';
import { AuthService } from '../auth/auth.service';
import { MemberStatus } from '../member/enums/member.enum';

@Injectable()
export class DoctorService {
	constructor(
		@InjectModel('Doctor') private readonly doctorModel: Model<Doctor>,
		private readonly authService: AuthService,
	) {}

	public async signupDoctor(input: DoctorInput): Promise<Doctor> {
		input.docPassword = await this.authService.hashPassword(input.docPassword);

		try {
			const doctor = await this.doctorModel.create(input);
			doctor.accessToken = await this.authService.createToken(doctor);
			return doctor;
		} catch (err) {
			console.log('Error, DoctorService.signupDoctor:', err.message);
			throw new BadRequestException(Message.USED_DOCTOR_NICK_PHONE_OR_MAIL);
		}
	}

	public async loginDoctor(input: DoctorLoginInput): Promise<Doctor> {
		const doctor = await this.doctorModel.findOne({ docNick: input.docNick }).select('+docPassword').exec();

		if (!doctor || doctor.memberStatus === MemberStatus.DELETE) {
			throw new InternalServerErrorException(Message.NO_DOCTOR_NICK);
		}
		if (doctor.memberStatus === MemberStatus.BLOCK) {
			throw new InternalServerErrorException(Message.BLOCKED_USER);
		}

		const isMatch = await this.authService.comparePassword(input.docPassword, doctor.docPassword);
		if (!isMatch) throw new InternalServerErrorException(Message.WRONG_PASSWORD);

		doctor.accessToken = await this.authService.createToken(doctor);
		return doctor;
	}

	public async getDoctors(input: DoctorsInquiry): Promise<Doctors> {
		const { text } = input.search;
		const match: T = {
			memberStatus: MemberStatus.ACTIVE,
			deletedAt: { $exists: false },
		};
		const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };

		if (input.docSpecialty) match.docSpecialty = input.docSpecialty;
		if (text) {
			const searchRegex = new RegExp(text, 'i');
			match.$or = [{ docNick: searchRegex }, { docFullName: searchRegex }];
		}
		console.log('match:', match);

		const result = await this.doctorModel
			.aggregate([
				{ $match: match },
				{ $sort: sort },
				{
					$facet: {
						list: [{ $skip: (input.page - 1) * input.limit }, { $limit: input.limit }],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		return result[0];
	}
}

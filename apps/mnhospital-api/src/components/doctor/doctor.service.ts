import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import ObjectId = Types.ObjectId;
import { Doctor, Doctors } from './dto/doctor';
import { DoctorInput, DoctorLoginInput, DoctorsInquiry } from './dto/doctor.input';
import { StatisticModifier, T } from '../../libs/types/common';
import { Direction, Message } from '../../libs/enums/common.enum';
import { AuthService } from '../auth/auth.service';
import { MemberStatus } from '../member/enums/member.enum';
import { LikeService } from '../like/like.service';
import { LikeInput } from '../like/dto/like.input';
import { LikeGroup } from '../like/enums/like.enum';

@Injectable()
export class DoctorService {
	constructor(
		@InjectModel('Doctor') private readonly doctorModel: Model<Doctor>,
		private readonly authService: AuthService,
		private readonly likeService: LikeService,
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

	public async getDoctor(targetId: ObjectId): Promise<Doctor> {
		const doctor = await this.doctorModel
			.findOne({
				_id: targetId,
				memberStatus: { $in: [MemberStatus.ACTIVE, MemberStatus.BLOCK] },
				deletedAt: { $exists: false },
			})
			.lean()
			.exec();

		if (!doctor) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		return doctor;
	}

	public async likeTargetDoctor(memberId: ObjectId, doctorId: ObjectId): Promise<Doctor> {
		const targetDoctor = await this.doctorModel
			.findOne({
				_id: doctorId,
				memberStatus: MemberStatus.ACTIVE,
				deletedAt: { $exists: false },
			})
			.exec();
		if (!targetDoctor) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const likeInput: LikeInput = {
			memberId,
			likeRefId: doctorId,
			likeGroup: LikeGroup.DOCTOR,
		};
		const modifier = await this.likeService.toggleLike(likeInput);
		const result = await this.doctorStatisticEditor({
			_id: doctorId,
			targetKey: 'docLikes',
			modifier,
		});

		if (!result) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
		return result;
	}

	public async doctorStatisticEditor(input: StatisticModifier): Promise<Doctor> {
		const { _id, targetKey, modifier } = input;

		const allowedKeys = ['docPoints', 'docPatients', 'docServices', 'docArticles', 'docLikes'];

		if (!allowedKeys.includes(targetKey)) {
			throw new BadRequestException('Invalid doctor statistic key');
		}

		const search: T = { _id };
		if (targetKey !== 'docServices') search.memberStatus = MemberStatus.ACTIVE;

		if (['docServices', 'docArticles', 'docLikes'].includes(targetKey) && modifier < 0) {
			search[targetKey] = { $gte: Math.abs(modifier) };
		}

		let result = await this.doctorModel
			.findOneAndUpdate(search, { $inc: { [targetKey]: modifier } }, { new: true })
			.exec();

		if (!result && ['docServices', 'docArticles', 'docLikes'].includes(targetKey) && modifier < 0) {
			result = await this.doctorModel.findOne({ _id }).exec();
		}

		if (!result) {
			throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		}

		return result;
	}
}

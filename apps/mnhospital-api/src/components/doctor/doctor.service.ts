import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Doctor, Doctors } from './dto/doctor';
import { DoctorsInquiry } from './dto/doctor.input';
import { T } from '../../libs/types/common';
import { Direction } from '../../libs/enums/common.enum';
import { DoctorSort } from './enums/doctor.enum';

@Injectable()
export class DoctorService {
	constructor(@InjectModel('Doctor') private readonly doctorModel: Model<Doctor>) {}

	public async getDoctors(input: DoctorsInquiry): Promise<Doctors> {
		const { page = 1, limit = 10, docSpecialty, search } = input;
		const match: T = { deletedAt: { $exists: false } };
		const sort: T = { [input.sort ?? DoctorSort.CREATED_AT]: input.direction ?? Direction.DESC };

		if (docSpecialty) match.docSpecialty = docSpecialty;
		if (search) {
			const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const searchPattern = new RegExp(escapedSearch, 'i');
			match.$or = [{ docNick: searchPattern }, { docFullName: searchPattern }, { docAddress: searchPattern }];
		}
		console.log('match:', match);

		const result = await this.doctorModel
			.aggregate<Doctors>([
				{ $match: match },
				{ $sort: sort },
				{
					$facet: {
						list: [{ $skip: (page - 1) * limit }, { $limit: limit }],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		return result[0] ?? { list: [], metaCounter: [] };
	}
}

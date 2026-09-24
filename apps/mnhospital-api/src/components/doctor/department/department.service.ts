import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message } from '../../../libs/enums/common.enum';
import { Department } from './dto/department';
import { DepartmentInput } from './dto/department.input';

@Injectable()
export class DepartmentService {
	constructor(@InjectModel('Department') private readonly departmentModel: Model<Department>) {}

	public async createDepartment(input: DepartmentInput): Promise<Department> {
		try {
			return await this.departmentModel.create(input);
		} catch (err) {
			console.error('Error, DepartmentService.createDepartment:', err);
			throw new BadRequestException(Message.CREATE_FAILED);
		}
	}
}

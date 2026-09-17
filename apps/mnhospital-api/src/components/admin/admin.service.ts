import { Injectable } from '@nestjs/common';

@Injectable()
export class AdminService {
	public async getAllMembersByAdmin(): Promise<string> {
		return 'getMember executed';
	}

	public async updateMemberByAdmin(): Promise<string> {
		return 'updateMember executed';
	}
}

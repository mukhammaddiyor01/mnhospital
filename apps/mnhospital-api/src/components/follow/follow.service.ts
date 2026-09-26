import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MemberService } from '../member/member.service';
import { AuthService } from '../auth/auth.service';
import { DoctorService } from '../doctor/doctor.service';
import { Follower, Following } from './dto/follow';

@Injectable()
export class FollowService {
	constructor(
		@InjectModel('Follow') private readonly followModel: Model<Follower | Following>,
		private readonly memberService: MemberService,
		private authService: AuthService,
		private readonly doctorService: DoctorService,
	) {}
}

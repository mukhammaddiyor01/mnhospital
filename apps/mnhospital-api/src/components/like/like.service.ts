import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Like } from './dto/like';
import { AuthService } from '../auth/auth.service';
import { Model } from 'mongoose';

@Injectable()
export class LikeService {
	constructor(
		@InjectModel('Like') private readonly LikeModel: Model<Like>,
		private authService: AuthService,
	) {}
}

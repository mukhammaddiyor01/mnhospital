import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AuthService } from '../auth/auth.service';
import { ViewService } from '../view/view.service';
import { Model } from 'mongoose';

@Injectable()
export class ServiceService {
	constructor(
		@InjectModel('service') private readonly serviceModel: Model<null>,
		private authService: AuthService,
		private viewService: ViewService,
	) {}
}

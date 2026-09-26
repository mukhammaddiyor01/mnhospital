import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { AdvertisementResolver } from './advertisement.resolver';
import { AdvertisementService } from './advertisement.service';
import AdvertisementSchema from './schema/Advertisement.model';

@Module({
	imports: [MongooseModule.forFeature([{ name: 'Advertisement', schema: AdvertisementSchema }]), AuthModule],
	providers: [AdvertisementService, AdvertisementResolver],
})
export class AdvertisementModule {}

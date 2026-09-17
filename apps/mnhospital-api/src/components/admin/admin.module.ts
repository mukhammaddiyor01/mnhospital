import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminService } from './admin.service';
import { AdminResolver } from './admin.resolver';
import AdminSchema from './schema/Admin.model';
import { AuthModule } from '../auth/auth.module';

@Module({
	imports: [MongooseModule.forFeature([{ name: 'Admin', schema: AdminSchema }]), AuthModule],
	exports: [MongooseModule],
	providers: [AdminService, AdminResolver],
})
export class AdminModule {}

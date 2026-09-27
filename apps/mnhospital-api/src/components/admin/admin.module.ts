import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminService } from './admin.service';
import { AdminResolver } from './admin.resolver';
import AdminSchema from './schema/Admin.model';
import { AuthModule } from '../auth/auth.module';
import MemberSchema from '../member/schema/Member.model';
import ServiceSchema from '../service/schema/Service.model';
import { DoctorModule } from '../doctor/doctor.module';
import ArticleSchema from '../article/schema/Article.model';
import CommentSchema from '../comment/schema/Comment.model';
import PatientSchema from '../patient/schema/Patient.model';
import DoctorSchema from '../doctor/schema/Doctor.model';
import ReceptionistSchema from '../receptionist/schema/Receptionist.model';
import BookingOrderSchema from '../patient/schema/BookingOrder.model';
import AppointmentSchema from '../../libs/schemas/Appointment.model';

@Module({
	imports: [
		MongooseModule.forFeature([
			{
				name: 'Admin',
				schema: AdminSchema,
			},
		]),
		MongooseModule.forFeature([
			{
				name: 'Member',
				schema: MemberSchema,
			},
			{
				name: 'Service',
				schema: ServiceSchema,
			},
			{
				name: 'Article',
				schema: ArticleSchema,
			},
			{
				name: 'Comment',
				schema: CommentSchema,
			},
			{ name: 'Patient', schema: PatientSchema },
			{ name: 'Doctor', schema: DoctorSchema },
			{ name: 'Receptionist', schema: ReceptionistSchema },
			{ name: 'BookingOrder', schema: BookingOrderSchema },
			{ name: 'Appointment', schema: AppointmentSchema },
		]),
		AuthModule,
		DoctorModule,
	],
	exports: [MongooseModule],
	providers: [AdminService, AdminResolver],
})
export class AdminModule {}

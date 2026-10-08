import MemberSchema from '../member/schema/Member.model';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import BookingOrderSchema from './schema/BookingOrder.model';
import CartSchema from './schema/Cart.model';
import CartItemSchema from './schema/CartItem.model';
import PatientSchema from './schema/Patient.model';
import PaymentSchema from './schema/Payment.model';
import { AuthModule } from '../auth/auth.module';
import { PatientResolver } from './patient.resolver';
import { PatientService } from './patient.service';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'Patient', schema: PatientSchema },
			{ name: 'Member', schema: MemberSchema },
			{ name: 'Cart', schema: CartSchema },
			{ name: 'CartItem', schema: CartItemSchema },
			{ name: 'BookingOrder', schema: BookingOrderSchema },
			{ name: 'Payment', schema: PaymentSchema },
		]),
		AuthModule,
	],
	exports: [MongooseModule, PatientService],
	providers: [PatientService, PatientResolver],
})
export class PatientModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import BookingOrderSchema from './schema/BookingOrder.model';
import CartSchema from './schema/Cart.model';
import CartItemSchema from './schema/CartItem.model';
import PatientSchema from './schema/Patient.model';
import PaymentSchema from './schema/Payment.model';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'Patient', schema: PatientSchema },
			{ name: 'Cart', schema: CartSchema },
			{ name: 'CartItem', schema: CartItemSchema },
			{ name: 'BookingOrder', schema: BookingOrderSchema },
			{ name: 'Payment', schema: PaymentSchema },
		]),
	],
	exports: [MongooseModule],
})
export class PatientModule {}

import { Field, ObjectType } from '@nestjs/graphql';
import { Patient } from '../../patient/dto/patient';
import { BookingOrder } from '../../booking/dto/booking-order';
import { Service } from '../../service/dto/service';
import { Appointment } from '../../appointment/dto/appointment';

@ObjectType()
export class PatientActivity {
	@Field(() => Patient)
	patient: Patient;

	@Field(() => [BookingOrder])
	bookingOrders: BookingOrder[];

	@Field(() => [Service])
	services: Service[];

	@Field(() => [Appointment])
	appointments: Appointment[];
}

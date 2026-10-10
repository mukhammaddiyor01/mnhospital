import { Field, ObjectType } from '@nestjs/graphql';
import { BookingOrderStatus } from '../../patient/enums/patient.enum';
import { AppointmentStatus } from '../../../libs/enums/appointment.enum';
import { TotalCounter } from '../../member/dto/member';

@ObjectType()
export class DoctorBookingRequest {
 @Field(() => AppointmentStatus, { nullable: true }) appointmentStatus?: AppointmentStatus;
	@Field(() => String)
	_id: string;

	@Field(() => String)
	bookingOrderId: string;

	@Field(() => String)
	orderCode: string;

	@Field(() => BookingOrderStatus)
	bookingOrderStatus: BookingOrderStatus;

	@Field(() => String)
	serviceId: string;

	@Field(() => String)
	serviceName: string;

	@Field(() => String)
	serviceDuration: string;

	@Field(() => String)
	requestedStartAt: string;

	@Field(() => String, { nullable: true })
	appointmentId?: string;
}

@ObjectType()
export class DoctorBookingRequests {
	@Field(() => [DoctorBookingRequest])
	list: DoctorBookingRequest[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter: TotalCounter[];
}

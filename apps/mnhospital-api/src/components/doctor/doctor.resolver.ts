import { Args, Query, Resolver } from '@nestjs/graphql';
import { DoctorService } from './doctor.service';
import { Doctors } from './dto/doctor';
import { DoctorsInquiry } from './dto/doctor.input';

@Resolver()
export class DoctorResolver {
	constructor(private readonly doctorService: DoctorService) {}

	@Query(() => Doctors)
	public async getDoctors(@Args('input') input: DoctorsInquiry): Promise<Doctors> {
		console.log('Query: getDoctors');
		return this.doctorService.getDoctors(input);
	}
}

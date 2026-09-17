import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { WithoutGuard } from '../auth/guards/without.guard';
import { DoctorService } from './doctor.service';
import { Doctor, Doctors } from './dto/doctor';
import { DoctorInput, DoctorLoginInput, DoctorsInquiry } from './dto/doctor.input';

@Resolver()
export class DoctorResolver {
	constructor(private readonly doctorService: DoctorService) {}

	@Mutation(() => Doctor)
	public async signupDoctor(@Args('input') input: DoctorInput): Promise<Doctor> {
		console.log('Mutation: signupDoctor');
		return this.doctorService.signupDoctor(input);
	}

	@Mutation(() => Doctor)
	public async loginDoctor(@Args('input') input: DoctorLoginInput): Promise<Doctor> {
		console.log('Mutation: loginDoctor');
		return this.doctorService.loginDoctor(input);
	}

	@UseGuards(WithoutGuard)
	@Query(() => Doctors)
	public async getDoctors(@Args('input') input: DoctorsInquiry): Promise<Doctors> {
		console.log('Query: getDoctors');
		return this.doctorService.getDoctors(input);
	}
}

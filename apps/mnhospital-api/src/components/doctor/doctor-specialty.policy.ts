import { BadRequestException } from '@nestjs/common';
import { DoctorSpecialty } from './enums/doctor.enum';
import { ServiceType } from '../service/enums/service.enum';

// Service categories, not clinical credentialing: generic categories apply across specialties.
const commonTypes = [ServiceType.CONSULTATION, ServiceType.DIAGNOSTIC, ServiceType.PROCEDURE, ServiceType.THERAPY, ServiceType.LABORATORY];
const specialtyTypes: Record<DoctorSpecialty, ServiceType[]> = {
	[DoctorSpecialty.GENERAL_PRACTITIONER]: [ServiceType.FAMILY_MEDICINE],
	[DoctorSpecialty.CARDIOLOGIST]: [ServiceType.CARDIOLOGY],
	[DoctorSpecialty.DERMATOLOGIST]: [ServiceType.DERMATOLOGY],
	[DoctorSpecialty.NEUROLOGIST]: [ServiceType.NEUROLOGY],
	[DoctorSpecialty.PEDIATRICIAN]: [ServiceType.PEDIATRICS],
	[DoctorSpecialty.SURGEON]: [],
	[DoctorSpecialty.DENTIST]: [ServiceType.DENTISTRY],
	[DoctorSpecialty.UROLOGIST]: [ServiceType.UROLOGY],
	[DoctorSpecialty.OPHTHALMOLOGIST]: [ServiceType.OPHTHAL],
	[DoctorSpecialty.NEUROSURGEON]: [ServiceType.NEUROSURGERY],
	[DoctorSpecialty.PLASTIC_SURGEON]: [ServiceType.PLASTIC_SURGERY],
	[DoctorSpecialty.OBSTETRICIAN_GYNECOLOGIST]: [ServiceType.OBSTETRICS_GYNECOLOGY],
	[DoctorSpecialty.FAMILY_PHYSICIAN]: [ServiceType.FAMILY_MEDICINE],
};

export function serviceTypesForSpecialty(specialty?: DoctorSpecialty): ServiceType[] {
	if (!specialty || !Object.prototype.hasOwnProperty.call(specialtyTypes, specialty)) return [];
	return [...commonTypes, ...specialtyTypes[specialty]];
}

export function assertSpecialtyServiceType(specialty: DoctorSpecialty | undefined, type: ServiceType): void {
	if (!serviceTypesForSpecialty(specialty).includes(type)) {
		throw new BadRequestException('Service type does not match the doctor specialty. Ask an admin to check the specialty.');
	}
}

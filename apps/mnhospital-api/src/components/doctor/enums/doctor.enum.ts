import { registerEnumType } from '@nestjs/graphql';

export enum DoctorSpecialty {
	GENERAL_PRACTITIONER = 'GENERAL_PRACTITIONER',
	CARDIOLOGIST = 'CARDIOLOGIST',
	DERMATOLOGIST = 'DERMATOLOGIST',
	NEUROLOGIST = 'NEUROLOGIST',
	PEDIATRICIAN = 'PEDIATRICIAN',
	SURGEON = 'SURGEON',
	DENTIST = 'DENTIST',
	UROLOGIST = 'UROLOGIST',
	OPHTHALMOLOGIST = 'OPHTHALMOLOGIST',
	NEUROSURGEON = 'NEUROSURGEON',
	PLASTIC_SURGEON = 'PLASTIC_SURGEON',
	OBSTETRICIAN_GYNECOLOGIST = 'OBSTETRICIAN_GYNECOLOGIST',
	FAMILY_PHYSICIAN = 'FAMILY_PHYSICIAN',
}
registerEnumType(DoctorSpecialty, { name: 'DoctorSpecialty' });

export enum DoctorSort {
	CREATED_AT = 'createdAt',
	POINTS = 'docPoints',
	EXPERIENCE = 'docExperience',
	PATIENTS = 'docPatients',
}
registerEnumType(DoctorSort, { name: 'DoctorSort' });

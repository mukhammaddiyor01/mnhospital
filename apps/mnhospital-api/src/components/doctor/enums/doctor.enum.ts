import { registerEnumType } from '@nestjs/graphql';

export enum DoctorSpecialty {
	GENERAL_PRACTITIONER = 'GENERAL_PRACTITIONER',
	CARDIOLOGIST = 'CARDIOLOGIST',
	DERMATOLOGIST = 'DERMATOLOGIST',
	NEUROLOGIST = 'NEUROLOGIST',
	PEDIATRICIAN = 'PEDIATRICIAN',
	SURGEON = 'SURGEON',
	DENTIST = 'DENTIST',
}
registerEnumType(DoctorSpecialty, { name: 'DoctorSpecialty' });

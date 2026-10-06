import { BadRequestException } from '@nestjs/common';
import { FileUpload } from 'graphql-upload';
import { mkdtemp, readdir, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { PatientResolver } from './patient.resolver';
import { PatientService } from './patient.service';

describe('Patient image upload', () => {
	let directory: string;
	let resolver: PatientResolver;
	let cwd: jest.SpyInstance;

	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'mn-patient-image-'));
		cwd = jest.spyOn(process, 'cwd').mockReturnValue(directory);
		resolver = new PatientResolver({} as PatientService);
	});

	afterEach(async () => {
		cwd.mockRestore();
		await rm(directory, { recursive: true, force: true });
	});

	const upload = (bytes: Buffer, mimetype = 'image/png') =>
		Promise.resolve({
			filename: 'photo.png',
			mimetype,
			encoding: '7bit',
			createReadStream: () => Readable.from([bytes]),
		} as FileUpload);

	it('stores a patient image in the fixed patient directory', async () => {
		const bytes = Buffer.from('image-data');
		const url = await resolver.uploadMyPatientImage(upload(bytes));
		expect(url).toMatch(/^uploads\/patient\/[\w-]+\.png$/);
		expect(await readFile(join(directory, url))).toEqual(bytes);
	});

	it('rejects oversized images and removes the partial file', async () => {
		await expect(resolver.uploadMyPatientImage(upload(Buffer.alloc(5 * 1024 * 1024 + 1)))).rejects.toBeInstanceOf(
			BadRequestException,
		);
		expect(await readdir(join(directory, 'uploads', 'patient'))).toEqual([]);
	});
});

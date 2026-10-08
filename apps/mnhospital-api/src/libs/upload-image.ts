import { BadRequestException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { FileUpload } from 'graphql-upload';
import { randomUUID } from 'crypto';
import { mkdir, unlink } from 'fs/promises';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { MemberType } from '../components/member/enums/member.enum';
export function checkUploadTarget(target: string, role: MemberType): void {
	const targets: Record<string, MemberType[]> = {
		member: [MemberType.PATIENT, MemberType.ADMIN],
		doctor: [MemberType.DOCTOR, MemberType.ADMIN],
		receptionist: [MemberType.RECEPTIONIST, MemberType.ADMIN],
		admin: [MemberType.ADMIN],
		service: [MemberType.DOCTOR, MemberType.ADMIN],
		article: [MemberType.DOCTOR, MemberType.ADMIN],
		department: [MemberType.DOCTOR, MemberType.ADMIN],
		advertisement: [MemberType.ADMIN],
	};
	if (!targets[target]) throw new BadRequestException('Invalid image target');
	if (!targets[target].includes(role)) throw new ForbiddenException('Image target is not allowed for your role');
}
export async function saveUploadedImage(file: FileUpload | Promise<FileUpload>, target: string): Promise<string> {
	const { mimetype, createReadStream } = await file;
	if (!['image/png', 'image/jpeg', 'image/jpg'].includes(mimetype))
		throw new BadRequestException('Please upload a PNG or JPEG image');
	const directory = join(process.cwd(), 'uploads', target);
	await mkdir(directory, { recursive: true });
	const name = `${randomUUID()}.${mimetype === 'image/png' ? 'png' : 'jpg'}`;
	const path = join(directory, name);
	let bytes = 0;
	const tooLarge = new Error('Image must be 5 MB or smaller');
	const limit = new Transform({
		transform(chunk: Buffer, _encoding, callback) {
			bytes += chunk.length;
			callback(bytes > 5 * 1024 * 1024 ? tooLarge : null, chunk);
		},
	});
	try {
		await pipeline(createReadStream(), limit, createWriteStream(path, { flags: 'wx' }));
		return `uploads/${target}/${name}`;
	} catch (error) {
		await unlink(path).catch(() => undefined);
		if (error === tooLarge) throw new BadRequestException(tooLarge.message);
		throw new InternalServerErrorException('Image could not be uploaded');
	}
}

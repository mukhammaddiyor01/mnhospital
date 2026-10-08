import { checkUploadTarget, saveUploadedImage } from './upload-image';
import { MemberType } from '../components/member/enums/member.enum';
import { Readable } from 'stream';
import { mkdtemp, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
describe('Workspace image upload', () => {
	it('rejects traversal and cross role targets', () => {
		expect(() => checkUploadTarget('../outside', MemberType.ADMIN)).toThrow();
		expect(() => checkUploadTarget('advertisement', MemberType.DOCTOR)).toThrow();
		expect(() => checkUploadTarget('service', MemberType.PATIENT)).toThrow();
		expect(() => checkUploadTarget('service', MemberType.DOCTOR)).not.toThrow();
		expect(() => checkUploadTarget('admin', MemberType.ADMIN)).not.toThrow();
		for (const role of [MemberType.PATIENT, MemberType.DOCTOR, MemberType.RECEPTIONIST])
			expect(() => checkUploadTarget('admin', role)).toThrow();
	});
	it('awaits uploads, writes images and removes oversized files', async () => {
		const before = process.cwd();
		const directory = await mkdtemp(join(tmpdir(), 'mn-workspace-image-'));
		process.chdir(directory);
		try {
			const file = { mimetype: 'image/png', createReadStream: () => Readable.from([Buffer.from('image')]) } as any;
			const saved = await saveUploadedImage(Promise.resolve(file), 'article');
			expect(saved).toMatch(/^uploads\/article\/[a-f0-9-]+\.png$/);
			await expect(
				saveUploadedImage(
					{ mimetype: 'image/png', createReadStream: () => Readable.from([Buffer.alloc(5 * 1024 * 1024 + 1)]) } as any,
					'article',
				),
			).rejects.toThrow('5 MB');
			expect(await readdir(join(directory, 'uploads/article'))).toHaveLength(1);
			await expect(saveUploadedImage({ mimetype: 'image/svg+xml' } as any, 'article')).rejects.toThrow('PNG');
		} finally {
			process.chdir(before);
			await rm(directory, { recursive: true, force: true });
		}
	});
});

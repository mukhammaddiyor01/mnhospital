import {
	BadRequestException,
	ForbiddenException,
	HttpException,
	Injectable,
	InternalServerErrorException,
	UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Subject } from 'rxjs';
import { MemberStatus, MemberType } from '../member/enums/member.enum';
import { T } from '../../libs/types/common';
import { AccountPasswordInput, AccountProfileInput } from './dto/account-profile.input';

export interface SessionRevocation {
	sessionId?: string;
	ownerId?: string;
	ownerType?: MemberType;
}
interface RefreshSessionRecord {
	_id: Types.ObjectId;
	ownerId: Types.ObjectId;
	ownerType: MemberType;
	profileVersion: number;
	tokenHash: string;
	usedTokenHashes: string[];
	expiresAt: Date;
	updatedAt: Date;
	revokedAt?: Date;
}
export const REFRESH_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
	private readonly revocations = new Subject<SessionRevocation>();
	constructor(
		private readonly jwtService: JwtService,
		@InjectModel('RefreshToken') private readonly sessions: Model<RefreshSessionRecord>,
		@InjectModel('Member') private readonly members: Model<any>,
		@InjectModel('Doctor') private readonly doctors: Model<any>,
		@InjectModel('Receptionist') private readonly receptionists: Model<any>,
		@InjectModel('Admin') private readonly admins: Model<any>,
	) {}

	private async database<Result>(action: () => Promise<Result>): Promise<Result> {
		try {
			return await action();
		} catch (error) {
			if (error instanceof HttpException) throw error;
			throw new InternalServerErrorException('Session service is unavailable');
		}
	}

	public onRevoked(handler: (event: SessionRevocation) => void) {
		return this.revocations.subscribe(handler);
	}
	public async hashPassword(password: string): Promise<string> {
		return bcrypt.hash(password, await bcrypt.genSalt());
	}
	public async comparePassword(password: string, hash: string): Promise<boolean> {
		return bcrypt.compare(password, hash);
	}

	private accountConfig(role: MemberType) {
		const configs = {
			[MemberType.PATIENT]: {
				model: this.members,
				password: 'memberPassword',
				fields: {
					nickname: 'memberNick',
					fullName: 'memberFullName',
					phone: 'memberPhone',
					email: 'memberMail',
					image: 'memberImage',
					description: 'memberDesc',
				},
			},
			[MemberType.DOCTOR]: {
				model: this.doctors,
				password: 'docPassword',
				fields: {
					nickname: 'docNick',
					fullName: 'docFullName',
					phone: 'docPhone',
					email: 'docMail',
					image: 'docImage',
					address: 'docAddress',
					description: 'docDesc',
					experience: 'docExperience',
				},
			},
			[MemberType.RECEPTIONIST]: {
				model: this.receptionists,
				password: 'receptionistPassword',
				fields: {
					nickname: 'receptionistNick',
					fullName: 'receptionistFullName',
					phone: 'receptionistPhone',
					email: 'receptionistMail',
					image: 'receptionistImage',
					address: 'receptionistAddress',
					description: 'receptionistDesc',
				},
			},
			[MemberType.ADMIN]: {
				model: this.admins,
				password: 'adminPassword',
				fields: {
					nickname: 'adminNick',
					phone: 'adminPhone',
					email: 'adminMail',
					image: 'adminImage',
					description: 'adminDesc',
				},
			},
		};
		if (!configs[role]) throw new UnauthorizedException('Invalid session identity');
		return configs[role];
	}

	private accountWriteFilter(profile: T) {
		return {
			_id: profile._id,
			memberType: profile.memberType,
			deletedAt: { $exists: false },
			...(profile.memberType === MemberType.ADMIN
				? { $or: [{ memberStatus: MemberStatus.ACTIVE }, { memberStatus: { $exists: false } }] }
				: { memberStatus: MemberStatus.ACTIVE }),
			sessionVersion: profile.sessionVersion ?? { $exists: false },
		};
	}

	public async updateAccountProfile(
		id: Types.ObjectId,
		role: MemberType,
		input: AccountProfileInput,
		sessionId: string,
	): Promise<string> {
		const profile = await this.getActiveProfile(id, role);
		const config = this.accountConfig(role);
		const updates: T = {},
			unset: T = {};
		for (const [key, value] of Object.entries(input)) {
			if (value === undefined) continue;
			const field = config.fields[key];
			if (!field || value === null)
				throw new BadRequestException('This field cannot be changed in your account profile');
			if (key === 'email' && value === '') {
				if (![MemberType.PATIENT, MemberType.DOCTOR].includes(role)) throw new BadRequestException('Email is required');
				unset[field] = 1;
			} else updates[field] = key === 'email' ? String(value).toLowerCase() : value;
		}
		if (!Object.keys(updates).length && !Object.keys(unset).length)
			throw new BadRequestException('No profile changes were provided');
		let updated: T;
		try {
			updated = await config.model
				.findOneAndUpdate(
					this.accountWriteFilter(profile),
					{
						$set: updates,
						...(Object.keys(unset).length ? { $unset: unset } : {}),
					},
					{ new: true, runValidators: true },
				)
				.lean()
				.exec();
		} catch (error) {
			if (error?.code === 11000) throw new BadRequestException('Nickname, phone or email is already in use');
			if (error?.name === 'ValidationError') throw new BadRequestException('Invalid profile values');
			throw new InternalServerErrorException('Profile update failed');
		}
		if (!updated) throw new UnauthorizedException('Account changed; please sign in again');
		return this.createToken(updated, sessionId);
	}

	public async changeAccountPassword(id: Types.ObjectId, role: MemberType, input: AccountPasswordInput) {
		const profile = await this.getActiveProfile(id, role);
		const config = this.accountConfig(role);
		const credentials = await this.database(() =>
			config.model.findOne(this.accountWriteFilter(profile)).select(`+${config.password}`).lean().exec(),
		);
		if (
			!credentials?.[config.password] ||
			!(await this.comparePassword(input.currentPassword, credentials[config.password]))
		) {
			throw new BadRequestException('Current password is incorrect');
		}
		if (input.currentPassword === input.newPassword) throw new BadRequestException('Choose a different new password');
		const hash = await this.hashPassword(input.newPassword);
		const updated = await this.database(() =>
			config.model
				.findOneAndUpdate(
					{
						...this.accountWriteFilter(profile),
						[config.password]: credentials[config.password],
					},
					{ $set: { [config.password]: hash }, $inc: { sessionVersion: 1 } },
					{ new: true, runValidators: true },
				)
				.lean()
				.exec(),
		);
		if (!updated) throw new UnauthorizedException('Account changed; please sign in again');
		await this.revokeOwnerSessions(id, role);
		return this.startSession(updated);
	}

	private hash(token: string): string {
		return createHash('sha256').update(token).digest('hex');
	}
	private equalHash(left: string, right: string): boolean {
		return (
			typeof left === 'string' &&
			/^[a-f0-9]{64}$/.test(left) &&
			timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'))
		);
	}
	private parseCredential(token: string): { id: Types.ObjectId; hash: string } {
		if (typeof token !== 'string' || !/^[a-f0-9]{24}\.[A-Za-z0-9_-]{43}$/.test(token))
			throw new UnauthorizedException('Invalid refresh session');
		return { id: new Types.ObjectId(token.slice(0, 24)), hash: this.hash(token) };
	}
	private newCredential(id: Types.ObjectId): string {
		return `${id}.${randomBytes(32).toString('base64url')}`;
	}

	public async getActiveProfile(id: Types.ObjectId, role: MemberType): Promise<T> {
		const model = {
			[MemberType.PATIENT]: this.members,
			[MemberType.DOCTOR]: this.doctors,
			[MemberType.RECEPTIONIST]: this.receptionists,
			[MemberType.ADMIN]: this.admins,
		}[role];
		if (!model) throw new UnauthorizedException('Invalid session identity');
		const status =
			role === MemberType.ADMIN
				? { $or: [{ memberStatus: MemberStatus.ACTIVE }, { memberStatus: { $exists: false } }] }
				: { memberStatus: MemberStatus.ACTIVE };
		const profile = await this.database(() =>
			model
				.findOne({ _id: id, memberType: role, ...status, deletedAt: { $exists: false } })
				.lean()
				.exec(),
		);
		if (!profile) throw new UnauthorizedException('Account is unavailable');
		return profile;
	}

	public async createToken(profile: T, sessionId?: string): Promise<string> {
		if (!/^[a-f0-9]{24}$/.test(sessionId ?? '')) throw new UnauthorizedException('A login session is required');
		const payload: T = {
			_id: String(profile._id),
			memberType: profile.memberType,
			sid: sessionId,
			tokenType: 'access',
		};
		for (const key of [
			'memberNick',
			'memberFullName',
			'memberImage',
			'docNick',
			'docFullName',
			'docImage',
			'receptionistNick',
			'receptionistFullName',
			'receptionistImage',
			'adminNick',
			'adminImage',
		]) {
			if (typeof profile[key] === 'string') payload[key] = profile[key];
		}
		return this.jwtService.signAsync(payload, { expiresIn: '15m' });
	}

	public async startSession(profile: T): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date; cookieExpiresAt: Date }> {
		const active = await this.getActiveProfile(new Types.ObjectId(String(profile._id)), profile.memberType);
		const id = new Types.ObjectId();
		const refreshToken = this.newCredential(id);
		const now = Date.now();
		const expiresAt = new Date(now + REFRESH_SESSION_MS);
		await this.database(() =>
			this.sessions.create({
				_id: id,
				ownerId: active._id,
				ownerType: active.memberType,
				profileVersion: active.sessionVersion ?? 0,
				tokenHash: this.hash(refreshToken),
				expiresAt,
			}),
		);
		return { accessToken: await this.createToken(active, String(id)), refreshToken, expiresAt, cookieExpiresAt: new Date(now + SESSION_IDLE_MS) };
	}

	private async assertSessionProfile(session: T): Promise<T> {
		try {
			const profile = await this.getActiveProfile(session.ownerId, session.ownerType);
			if ((profile.sessionVersion ?? 0) !== session.profileVersion)
				throw new UnauthorizedException('Session was revoked');
			return profile;
		} catch (error) {
			if (error instanceof UnauthorizedException) await this.revokeSession(String(session._id));
			throw error;
		}
	}

	public async verifyToken(token: string): Promise<T> {
		let claims: T;
		try {
			claims = await this.jwtService.verifyAsync(token);
		} catch {
			throw new UnauthorizedException('Invalid or expired access token');
		}
		if (
			!Number.isFinite(claims.exp) ||
			!Number.isFinite(claims.iat) ||
			claims.tokenType !== 'access' ||
			!/^[a-f0-9]{24}$/.test(claims.sid ?? '') ||
			!/^[a-f0-9]{24}$/.test(claims._id ?? '') ||
			!Object.values(MemberType).includes(claims.memberType)
		) {
			throw new UnauthorizedException('Invalid session identity');
		}
		const now = Date.now();
		const session = await this.database(() =>
			this.sessions
				.findOne({
					_id: new Types.ObjectId(claims.sid),
					ownerId: new Types.ObjectId(claims._id),
					ownerType: claims.memberType,
					revokedAt: null,
					expiresAt: { $gt: new Date(now) },
					updatedAt: { $gt: new Date(now - SESSION_IDLE_MS) },
				})
				.lean()
				.exec(),
		);
		if (!session) throw new UnauthorizedException('Session was revoked');
		const profile = await this.assertSessionProfile(session);
		return { ...claims, _id: profile._id };
	}

	public async refreshSession(token: string, expectedAccessToken?: string) {
		let expected: T | undefined;
		if (expectedAccessToken) {
			try {
				expected = await this.jwtService.verifyAsync(expectedAccessToken, { ignoreExpiration: true });
			} catch {
				throw new ForbiddenException('Session was replaced');
			}
			if (expected.tokenType !== 'access' || expected.sid !== token.slice(0, 24))
				throw new ForbiddenException('Session was replaced');
		}
		const credential = this.parseCredential(token);
		const now = Date.now();
		const validSession = {
			_id: credential.id,
			revokedAt: null,
			expiresAt: { $gt: new Date(now) },
			updatedAt: { $gt: new Date(now - SESSION_IDLE_MS) },
		};
		const session = await this.database(() =>
			this.sessions
				.findOne(validSession)
				.select('+tokenHash +usedTokenHashes')
				.lean()
				.exec(),
		);
		if (!session) throw new UnauthorizedException('Invalid refresh session');
		if (expected && (String(session.ownerId) !== expected._id || session.ownerType !== expected.memberType))
			throw new ForbiddenException('Session was replaced');
		if (!this.equalHash(session.tokenHash, credential.hash)) {
			if ((session.usedTokenHashes ?? []).includes(credential.hash)) await this.revokeSession(String(session._id));
			throw new UnauthorizedException('Invalid refresh session');
		}
		const profile = await this.assertSessionProfile(session);
		const refreshToken = this.newCredential(session._id);
		const rotated = await this.database(() =>
			this.sessions
				.findOneAndUpdate(
					{ ...validSession, tokenHash: credential.hash },
					{ $set: { tokenHash: this.hash(refreshToken) }, $push: { usedTokenHashes: credential.hash } },
					{ new: true },
				)
				.lean()
				.exec(),
		);
		if (!rotated) {
			await this.revokeSession(String(session._id));
			throw new UnauthorizedException('Refresh token was already used');
		}
		return {
			accessToken: await this.createToken(profile, String(session._id)),
			refreshToken,
			expiresAt: session.expiresAt,
			cookieExpiresAt: new Date(Math.min(session.expiresAt.getTime(), Date.now() + SESSION_IDLE_MS)),
		};
	}

	public async revokeSession(id: string): Promise<void> {
		await this.database(() =>
			this.sessions
				.updateOne({ _id: new Types.ObjectId(id), revokedAt: null }, { $set: { revokedAt: new Date() } })
				.exec(),
		);
		this.revocations.next({ sessionId: id });
	}
	public async logoutCredential(token: string): Promise<void> {
		let credential: { id: Types.ObjectId; hash: string };
		try {
			credential = this.parseCredential(token);
		} catch {
			return;
		}
		const session = await this.database(() =>
			this.sessions
				.findOne({ _id: credential.id, $or: [{ tokenHash: credential.hash }, { usedTokenHashes: credential.hash }] })
				.lean()
				.exec(),
		);
		if (session) await this.revokeSession(String(session._id));
	}
	public async logoutAccessToken(token: string): Promise<string | undefined> {
		let claims: T;
		try {
			claims = await this.jwtService.verifyAsync(token, { ignoreExpiration: true });
		} catch {
			return;
		}
		if (
			claims.tokenType !== 'access' ||
			!/^[a-f0-9]{24}$/.test(claims.sid ?? '') ||
			!/^[a-f0-9]{24}$/.test(claims._id ?? '') ||
			!Object.values(MemberType).includes(claims.memberType)
		)
			return;
		const session = await this.database(() =>
			this.sessions
				.findOne({
					_id: new Types.ObjectId(claims.sid),
					ownerId: new Types.ObjectId(claims._id),
					ownerType: claims.memberType,
				})
				.lean()
				.exec(),
		);
		if (session) await this.revokeSession(String(session._id));
		return claims.sid;
	}

	public async revokeOwnerSessions(id: Types.ObjectId, role: MemberType): Promise<void> {
		await this.database(() =>
			this.sessions
				.updateMany({ ownerId: id, ownerType: role, revokedAt: null }, { $set: { revokedAt: new Date() } })
				.exec(),
		);
		this.revocations.next({ ownerId: String(id), ownerType: role });
	}
}

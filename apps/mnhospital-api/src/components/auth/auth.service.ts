import { HttpException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Subject } from 'rxjs';
import { MemberStatus, MemberType } from '../member/enums/member.enum';
import { T } from '../../libs/types/common';

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
	revokedAt?: Date;
}
export const REFRESH_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

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

	public async startSession(profile: T): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
		const active = await this.getActiveProfile(new Types.ObjectId(String(profile._id)), profile.memberType);
		const id = new Types.ObjectId();
		const refreshToken = this.newCredential(id);
		const expiresAt = new Date(Date.now() + REFRESH_SESSION_MS);
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
		return { accessToken: await this.createToken(active, String(id)), refreshToken, expiresAt };
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
		const session = await this.database(() =>
			this.sessions
				.findOne({
					_id: new Types.ObjectId(claims.sid),
					ownerId: new Types.ObjectId(claims._id),
					ownerType: claims.memberType,
					revokedAt: null,
					expiresAt: { $gt: new Date() },
				})
				.lean()
				.exec(),
		);
		if (!session) throw new UnauthorizedException('Session was revoked');
		const profile = await this.assertSessionProfile(session);
		return { ...claims, _id: profile._id };
	}

	public async refreshSession(token: string) {
		const credential = this.parseCredential(token);
		const session = await this.database(() =>
			this.sessions
				.findOne({ _id: credential.id, revokedAt: null, expiresAt: { $gt: new Date() } })
				.select('+tokenHash +usedTokenHashes')
				.lean()
				.exec(),
		);
		if (!session) throw new UnauthorizedException('Invalid refresh session');
		if (!this.equalHash(session.tokenHash, credential.hash)) {
			if ((session.usedTokenHashes ?? []).includes(credential.hash)) await this.revokeSession(String(session._id));
			throw new UnauthorizedException('Invalid refresh session');
		}
		const profile = await this.assertSessionProfile(session);
		const refreshToken = this.newCredential(session._id);
		const rotated = await this.database(() =>
			this.sessions
				.findOneAndUpdate(
					{ _id: session._id, tokenHash: credential.hash, revokedAt: null, expiresAt: { $gt: new Date() } },
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
	public async logoutAccessToken(token: string): Promise<void> {
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

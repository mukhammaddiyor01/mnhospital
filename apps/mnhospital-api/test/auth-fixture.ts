import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { AuthService } from '../src/components/auth/auth.service';
import { MemberStatus, MemberType } from '../src/components/member/enums/member.enum';

export function matches(record: any, filter: any): boolean {
	return Object.entries(filter).every(([key, expected]: [string, any]) => {
		if (key === '$or') return expected.some((branch: any) => matches(record, branch));
		const actual = record[key];
		if (expected === null) return actual == null;
		if (
			expected &&
			typeof expected === 'object' &&
			!(expected instanceof Date) &&
			!(expected instanceof Types.ObjectId)
		) {
			return Object.entries(expected).every(([op, value]: [string, any]) => {
				if (op === '$exists') return (actual !== undefined) === value;
				if (op === '$gt') return actual > value;
				if (op === '$ne') return String(actual) !== String(value);
				if (op === '$in') return value.some((item: any) => String(item) === String(actual));
				return false;
			});
		}
		return String(actual) === String(expected);
	});
}
export function query(action: () => any) {
	const result: any = { exec: async () => action(), select: () => result, lean: () => result };
	return result;
}
export function createAuthFixture() {
	const records = new Map<string, any>();
	const profiles = Object.fromEntries(Object.values(MemberType).map((role) => [role, new Map<string, any>()]));
	const clone = (row: any) => (row ? { ...row, usedTokenHashes: [...(row.usedTokenHashes ?? [])] } : null);
	const find = (filter: any) => [...records.values()].find((row) => matches(row, filter));
	const apply = (row: any, update: any) => {
		if (!row) return null;
		Object.assign(row, update.$set);
		for (const [key, value] of Object.entries(update.$push ?? {})) row[key].push(value);
		row.updatedAt = new Date();
		return clone(row);
	};
	const sessions = {
		create: jest.fn(async (row) => {
			const record = { ...row, usedTokenHashes: [], createdAt: new Date(), updatedAt: new Date() };
			records.set(String(row._id), record);
			return record;
		}),
		findOne: jest.fn((filter) => query(() => clone(find(filter)))),
		findOneAndUpdate: jest.fn((filter, update) => query(() => apply(find(filter), update))),
		updateOne: jest.fn((filter, update) => query(() => ({ modifiedCount: apply(find(filter), update) ? 1 : 0 }))),
		updateMany: jest.fn((filter, update) =>
			query(() => {
				let count = 0;
				for (const row of records.values())
					if (matches(row, filter)) {
						apply(row, update);
						count++;
					}
				return { modifiedCount: count };
			}),
		),
	};
	const models = Object.fromEntries(
		Object.values(MemberType).map((role) => [
			role,
			{
				findOne: jest.fn((filter) =>
					query(() => [...profiles[role].values()].find((row) => matches(row, filter)) ?? null),
				),
			},
		]),
	);
	const jwt = new JwtService({ secret: 'auth-session-regression-secret' });
	const auth = new AuthService(
		jwt,
		sessions as any,
		models.PATIENT as any,
		models.DOCTOR as any,
		models.RECEPTIONIST as any,
		models.ADMIN as any,
	);
	const profile = (role: MemberType, id = new Types.ObjectId()) => {
		const row = {
			_id: id,
			memberType: role,
			memberStatus: MemberStatus.ACTIVE,
			sessionVersion: 0,
			memberNick: role.toLowerCase(),
			memberPassword: 'private-hash',
			docPhone: 'private-contact',
			docDesc: 'private-description',
		};
		profiles[role].set(String(id), row);
		return row;
	};
	return { auth, jwt, sessions, records, profiles, models, profile };
}

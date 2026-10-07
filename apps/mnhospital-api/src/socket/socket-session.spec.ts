import { Types } from 'mongoose';
import { WebSocket } from 'ws';
import { createAuthFixture } from '../../test/auth-fixture';
import { MemberType } from '../components/member/enums/member.enum';
import { SocketGateway } from './socket.gateway';
import { MessagingEventsService } from '../components/messaging/messaging-events.service';

const client = () => ({ readyState: WebSocket.OPEN, send: jest.fn(), close: jest.fn() }) as any;
const frames = (socket: any) => socket.send.mock.calls.map(([value]) => JSON.parse(value));
describe('WebSocket session revocation', () => {
	let fixture: ReturnType<typeof createAuthFixture>, gateway: SocketGateway, messaging: MessagingEventsService;
	let storage: any;
	beforeEach(() => {
		fixture = createAuthFixture();
		messaging = new MessagingEventsService();
		storage = {
			getRecentMessages: jest.fn(async () => []),
			createMessage: jest.fn(async () => ({ id: 'public-message' })),
		};
		gateway = new SocketGateway(fixture.auth, messaging, storage);
		gateway.afterInit();
	});
	afterEach(() => gateway.onModuleDestroy());
	async function connect(role: MemberType, id?: Types.ObjectId) {
		const owner = fixture.profile(role, id);
		const session = await fixture.auth.startSession(owner);
		const socket = client();
		await gateway.handleConnection(socket, { url: '/?token=' + session.accessToken } as any);
		return { owner, session, socket };
	}
	it.each(Object.values(MemberType))(
		'immediately closes %s sockets on logout and prevents later writes',
		async (role) => {
			const actor = await connect(role);
			const guest = client();
			await gateway.handleConnection(guest, { url: '/' } as any);
			await fixture.auth.logoutCredential(actor.session.refreshToken);
			expect(actor.socket.close).toHaveBeenCalledWith(1008, 'Session is unavailable');
			await gateway.handleMessage(actor.socket, 'Rejected');
			expect(storage.createMessage).not.toHaveBeenCalled();
			await gateway.handleMessage(guest, 'Guest remains available');
			expect(storage.createMessage).toHaveBeenCalledTimes(1);
		},
	);
	it('keeps role collisions isolated when an owner is blocked', async () => {
		const id = new Types.ObjectId();
		const doctor = await connect(MemberType.DOCTOR, id);
		const patient = await connect(MemberType.PATIENT, id);
		await fixture.auth.revokeOwnerSessions(id, MemberType.DOCTOR);
		expect(doctor.socket.close).toHaveBeenCalled();
		expect(patient.socket.close).not.toHaveBeenCalled();
	});
	it('rejects already-connected sessions before inbound writes when status changes on another API instance', async () => {
		const actor = await connect(MemberType.RECEPTIONIST);
		actor.owner.sessionVersion++;
		await gateway.handleMessage(actor.socket, 'Rejected');
		expect(storage.createMessage).not.toHaveBeenCalled();
		expect(actor.socket.close).toHaveBeenCalled();
	});
	it('checks current authorization before private outbound delivery', async () => {
		const actor = await connect(MemberType.DOCTOR);
		actor.owner.sessionVersion++;
		const before = frames(actor.socket).length;
		messaging.publishMessageCreated({
			conversationId: new Types.ObjectId(),
			participants: [{ participantId: actor.owner._id, participantType: MemberType.DOCTOR } as any],
			message: { messageContent: 'private' } as any,
		});
		await new Promise((resolve) => setImmediate(resolve));
		expect(frames(actor.socket)).toHaveLength(before);
		expect(actor.socket.close).toHaveBeenCalled();
	});
	it('closes idle expired sessions through the periodic check', async () => {
		jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
		gateway.onModuleDestroy();
		gateway.afterInit();
		try {
			const actor = await connect(MemberType.ADMIN);
			jest.setSystemTime(Date.now() + 16 * 60 * 1000);
			await jest.advanceTimersByTimeAsync(30000);
			await new Promise<void>((resolve) => {
				resolve();
			});
			await Promise.resolve();
			await Promise.resolve();
			expect(actor.socket.close).toHaveBeenCalled();
		} finally {
			jest.useRealTimers();
		}
	});
});

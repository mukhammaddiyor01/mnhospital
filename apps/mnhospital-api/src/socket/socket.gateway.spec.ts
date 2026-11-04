import { IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import { AuthService } from '../components/auth/auth.service';
import { MemberType } from '../components/member/enums/member.enum';
import { MessagingEventsService } from '../components/messaging/messaging-events.service';
import { Types } from 'mongoose';
import { SocketGateway } from './socket.gateway';
import { GeneralChatService } from './general-chat.service';

const client = () => ({ readyState: WebSocket.OPEN, send: jest.fn(), close: jest.fn() }) as unknown as WebSocket;
const request = (url = '/') => ({ url }) as IncomingMessage;
const events = (socket: WebSocket) => (socket.send as jest.Mock).mock.calls.map(([value]) => JSON.parse(value));

describe('General live chat', () => {
	const verifyToken = jest.fn();
	let onCreated: (event: any) => void;
	let onRead: (event: any) => void;
	const unsubscribe = jest.fn();
	let gateway: SocketGateway;
	let stored: any[];
	let storage: { getRecentMessages: jest.Mock; createMessage: jest.Mock };

	beforeEach(() => {
		verifyToken.mockReset();
		stored = [];
		storage = {
			getRecentMessages: jest.fn(async () => stored.slice(-50)),
			createMessage: jest.fn(async (identity, text) => {
				const message = {
					id: String(stored.length),
					name: identity.name,
					role: identity.role,
					text,
					createdAt: new Date().toISOString(),
				};
				stored.push(message);
				return message;
			}),
		};
		gateway = new SocketGateway(
			{ verifyToken, onRevoked: () => ({ unsubscribe }) } as unknown as AuthService,
			{
				onMessageCreated: (handler: (event: any) => void) => {
					onCreated = handler;
					return { unsubscribe };
				},
				onMessagesRead: (handler: (event: any) => void) => {
					onRead = handler;
					return { unsubscribe };
				},
			} as unknown as MessagingEventsService,
			storage as unknown as GeneralChatService,
		);
	});

	it('admits a guest, sends history, and broadcasts under the Guest name', async () => {
		const guest = client();
		const other = client();
		await gateway.handleConnection(guest, request());
		await gateway.handleConnection(other, request());
		await gateway.handleMessage(guest, { text: '  Hello  ' });
		expect(events(guest)[0]).toEqual({ event: 'getMessages', list: [] });
		expect(events(other).slice(-1)[0]).toMatchObject({
			event: 'message',
			data: { text: 'Hello', name: 'Guest', role: 'GUEST' },
		});
		expect(verifyToken).not.toHaveBeenCalled();
	});

	it('rejects a browser WebSocket from an untrusted origin before reading chat history', async () => {
		const previous = process.env.AUTH_ALLOWED_ORIGINS;
		process.env.AUTH_ALLOWED_ORIGINS = 'https://mnhospital.uz';
		try {
			const untrusted = client();
			await gateway.handleConnection(untrusted, { url: '/', headers: { origin: 'https://attacker.invalid' } } as IncomingMessage);
			expect(untrusted.close).toHaveBeenCalledWith(1008, 'Origin not allowed');
			expect(storage.getRecentMessages).not.toHaveBeenCalled();
			const trusted = client();
			await gateway.handleConnection(trusted, { url: '/', headers: { origin: 'https://mnhospital.uz' } } as IncomingMessage);
			expect(events(trusted)[0]).toEqual({ event: 'getMessages', list: [] });
		} finally {
			if (previous === undefined) delete process.env.AUTH_ALLOWED_ORIGINS;
			else process.env.AUTH_ALLOWED_ORIGINS = previous;
		}
	});

	it('uses the verified profile identity and rejects an invalid supplied token', async () => {
		verifyToken.mockResolvedValueOnce({
			_id: new Types.ObjectId(),
			memberType: MemberType.DOCTOR,
			docFullName: 'Dr Lee',
		});
		const doctor = client();
		await gateway.handleConnection(doctor, request('/?token=valid'));
		await gateway.handleMessage(doctor, { text: 'Available', name: 'Impersonated' } as any);
		expect(events(doctor).slice(-1)[0]).toMatchObject({
			event: 'message',
			data: { name: 'Dr Lee', role: MemberType.DOCTOR },
		});

		verifyToken.mockRejectedValueOnce(new Error('expired'));
		const rejected = client();
		await gateway.handleConnection(rejected, request('/?token=expired'));
		expect(rejected.close).toHaveBeenCalledWith(1008, 'Invalid token');
		await gateway.handleMessage(rejected, 'should not appear');
		expect(rejected.send).not.toHaveBeenCalled();
	});

	it('delivers a saved private message only to verified conversation participants', async () => {
		const doctorId = new Types.ObjectId();
		const patientId = new Types.ObjectId();
		const outsiderId = new Types.ObjectId();
		const guest = client();
		const doctor = client();
		const patient = client();
		const outsider = client();
		await gateway.handleConnection(guest, request());
		verifyToken.mockResolvedValueOnce({ _id: doctorId, memberType: MemberType.DOCTOR, docFullName: 'Doctor' });
		await gateway.handleConnection(doctor, request('/?token=doctor'));
		verifyToken.mockResolvedValueOnce({ _id: patientId, memberType: MemberType.PATIENT, memberFullName: 'Patient' });
		await gateway.handleConnection(patient, request('/?token=patient'));
		verifyToken.mockResolvedValueOnce({ _id: outsiderId, memberType: MemberType.ADMIN, adminNick: 'Admin' });
		await gateway.handleConnection(outsider, request('/?token=outsider'));
		gateway.afterInit();
		const conversationId = new Types.ObjectId();
		await onCreated({
			conversationId,
			participants: [
				{ participantId: doctorId, participantType: MemberType.DOCTOR },
				{ participantId: patientId, participantType: MemberType.PATIENT },
			],
			message: { _id: new Types.ObjectId(), messageContent: 'Private' },
		});
		expect(events(doctor).filter((event) => event.event === 'privateMessage')).toHaveLength(1);
		expect(events(patient).filter((event) => event.event === 'privateMessage')).toHaveLength(1);
		expect(events(guest).filter((event) => event.event === 'privateMessage')).toHaveLength(0);
		expect(events(outsider).filter((event) => event.event === 'privateMessage')).toHaveLength(0);
		await onRead({
			conversationId,
			participants: [
				{ participantId: doctorId, participantType: MemberType.DOCTOR },
				{ participantId: patientId, participantType: MemberType.PATIENT },
			],
			readerId: patientId,
			readerType: MemberType.PATIENT,
			readAt: new Date(),
		});
		expect(events(doctor).filter((event) => event.event === 'privateRead')).toHaveLength(1);
		expect(events(guest).filter((event) => event.event === 'privateRead')).toHaveLength(0);
		expect(events(outsider).filter((event) => event.event === 'privateRead')).toHaveLength(0);
		gateway.onModuleDestroy();
		expect(unsubscribe).toHaveBeenCalled();
	});

	it('rejects invalid text and retains only the latest fifty messages', async () => {
		const guest = client();
		await gateway.handleConnection(guest, request());
		await gateway.handleMessage(guest, '   ');
		await gateway.handleMessage(guest, 'x'.repeat(501));
		expect(events(guest).filter((event) => event.event === 'error')).toHaveLength(2);
		for (let number = 0; number < 51; number++) await gateway.handleMessage(guest, `Message ${number}`);
		const newcomer = client();
		await gateway.handleConnection(newcomer, request());
		const history = events(newcomer)[0];
		expect(history.list).toHaveLength(50);
		expect(history.list[0].text).toBe('Message 1');
	});

	it('loads persisted history when a new gateway instance starts', async () => {
		const guest = client();
		await gateway.handleConnection(guest, request());
		await gateway.handleMessage(guest, 'Before restart');
		const restarted = new SocketGateway({ verifyToken } as any, {} as any, storage as any);
		const newcomer = client();
		await restarted.handleConnection(newcomer, request());
		expect(events(newcomer)[0].list).toMatchObject([{ text: 'Before restart', name: 'Guest', role: 'GUEST' }]);
	});

	it('broadcasts and acknowledges only after storage succeeds', async () => {
		const guest = client();
		await gateway.handleConnection(guest, request());
		let finish: (message: any) => void;
		storage.createMessage.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		const pending = gateway.handleMessage(guest, { text: 'Waiting', requestId: 'request-1' });
		expect(events(guest).filter((event) => ['message', 'messageSent'].includes(event.event))).toHaveLength(0);
		await Promise.resolve();
		finish({ id: 'saved', text: 'Waiting', name: 'Guest', role: 'GUEST', createdAt: new Date().toISOString() });
		await pending;
		expect(
			events(guest)
				.slice(-2)
				.map((event) => event.event),
		).toEqual(['message', 'messageSent']);
		expect(events(guest).slice(-1)[0]).toEqual({ event: 'messageSent', requestId: 'request-1' });
	});

	it('does not broadcast a failed write or expose database errors', async () => {
		const guest = client();
		const other = client();
		await gateway.handleConnection(guest, request());
		await gateway.handleConnection(other, request());
		storage.createMessage.mockRejectedValueOnce(new Error('private database connection details'));
		await gateway.handleMessage(guest, { text: 'Failing', requestId: 'request-2' });
		expect(events(other).filter((event) => event.event === 'message')).toHaveLength(0);
		expect(events(guest).slice(-1)[0]).toMatchObject({
			event: 'error',
			code: 'GENERAL_SEND_FAILED',
			requestId: 'request-2',
		});
		expect(JSON.stringify(events(guest))).not.toContain('private database');
	});

	it('rejects non-string text safely and keeps the connection usable when history fails', async () => {
		storage.getRecentMessages.mockRejectedValueOnce(new Error('database unavailable'));
		const guest = client();
		await gateway.handleConnection(guest, request());
		expect(events(guest)[0]).toMatchObject({ event: 'error', code: 'GENERAL_HISTORY_UNAVAILABLE' });
		await gateway.handleMessage(guest, { text: 123 });
		expect(storage.createMessage).not.toHaveBeenCalled();
		expect(events(guest).slice(-1)[0]).toMatchObject({ code: 'INVALID_GENERAL_MESSAGE' });
	});
});

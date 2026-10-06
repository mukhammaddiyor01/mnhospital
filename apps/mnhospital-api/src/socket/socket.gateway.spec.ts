import { IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import { AuthService } from '../components/auth/auth.service';
import { MemberType } from '../components/member/enums/member.enum';
import { SocketGateway } from './socket.gateway';

const client = () => ({ readyState: WebSocket.OPEN, send: jest.fn(), close: jest.fn() }) as unknown as WebSocket;
const request = (url = '/') => ({ url }) as IncomingMessage;
const events = (socket: WebSocket) => (socket.send as jest.Mock).mock.calls.map(([value]) => JSON.parse(value));

describe('General live chat', () => {
	const verifyToken = jest.fn();
	let gateway: SocketGateway;

	beforeEach(() => {
		verifyToken.mockReset();
		gateway = new SocketGateway({ verifyToken } as unknown as AuthService);
	});

	it('admits a guest, sends history, and broadcasts under the Guest name', async () => {
		const guest = client();
		const other = client();
		await gateway.handleConnection(guest, request());
		await gateway.handleConnection(other, request());
		gateway.handleMessage(guest, { text: '  Hello  ' });
		expect(events(guest)[0]).toEqual({ event: 'getMessages', list: [] });
		expect(events(other).slice(-1)[0]).toMatchObject({ event: 'message', data: { text: 'Hello', name: 'Guest', role: 'GUEST' } });
		expect(verifyToken).not.toHaveBeenCalled();
	});

	it('uses the verified profile identity and rejects an invalid supplied token', async () => {
		verifyToken.mockResolvedValueOnce({ memberType: MemberType.DOCTOR, docFullName: 'Dr Lee' });
		const doctor = client();
		await gateway.handleConnection(doctor, request('/?token=valid'));
		gateway.handleMessage(doctor, { text: 'Available', name: 'Impersonated' } as any);
		expect(events(doctor).slice(-1)[0]).toMatchObject({ event: 'message', data: { name: 'Dr Lee', role: MemberType.DOCTOR } });

		verifyToken.mockRejectedValueOnce(new Error('expired'));
		const rejected = client();
		await gateway.handleConnection(rejected, request('/?token=expired'));
		expect(rejected.close).toHaveBeenCalledWith(1008, 'Invalid token');
		gateway.handleMessage(rejected, 'should not appear');
		expect(rejected.send).not.toHaveBeenCalled();
	});

	it('rejects invalid text and retains only the latest fifty messages', async () => {
		const guest = client();
		await gateway.handleConnection(guest, request());
		gateway.handleMessage(guest, '   ');
		gateway.handleMessage(guest, 'x'.repeat(501));
		expect(events(guest).filter((event) => event.event === 'error')).toHaveLength(2);
		for (let number = 0; number < 51; number++) gateway.handleMessage(guest, `Message ${number}`);
		const newcomer = client();
		await gateway.handleConnection(newcomer, request());
		const history = events(newcomer)[0];
		expect(history.list).toHaveLength(50);
		expect(history.list[0].text).toBe('Message 1');
	});
});

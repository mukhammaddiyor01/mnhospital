import { of, throwError } from 'rxjs';
import { AiChatProvider } from './ai-chat.provider';

describe('AI provider transport', () => {
	const config = {
		get: jest.fn((key: string) => ({ AI_CHAT_API_KEY: 'server-secret', AI_CHAT_MODEL: 'configured-model' })[key]),
	};
	it('sends a bounded non-stored request with a server authorization header', async () => {
		const http = { post: jest.fn(() => of({ data: { choices: [{ message: { content: '  Public answer  ' } }] } })) };
		const provider = new AiChatProvider(config as any, http as any);
		expect(provider.isConfigured()).toBe(true);
		expect(await provider.reply('instructions', 'question')).toBe('Public answer');
		expect(http.post).toHaveBeenCalledWith(
			'https://api.openai.com/v1/chat/completions',
			expect.objectContaining({
				store: false,
				max_completion_tokens: 600,
				model: 'configured-model',
				messages: [
					{ role: 'system', content: 'instructions' },
					{ role: 'user', content: 'question' },
				],
			}),
			expect.objectContaining({ timeout: 20000, maxRedirects: 0, headers: { Authorization: 'Bearer server-secret' } }),
		);
	});
	it('rejects empty output so the service can show an unavailable state', async () => {
		const provider = new AiChatProvider(config as any, { post: () => of({ data: { choices: [] } }) } as any);
		await expect(provider.reply('instructions', 'question')).rejects.toThrow('Empty assistant reply');
	});
	it('propagates transport failures to the safe service boundary', async () => {
		const provider = new AiChatProvider(
			config as any,
			{ post: () => throwError(() => new Error('transport failed')) } as any,
		);
		await expect(provider.reply('instructions', 'question')).rejects.toThrow('transport failed');
	});
});

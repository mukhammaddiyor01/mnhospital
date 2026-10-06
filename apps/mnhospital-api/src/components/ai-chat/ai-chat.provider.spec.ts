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

describe('Gemini assistant transport', () => {
	it('uses the Google endpoint and key header without sending credentials to OpenAI', async () => {
		const values = {
			AI_CHAT_PROVIDER: 'gemini',
			AI_CHAT_ENABLED: 'true',
			AI_CHAT_MODEL: 'gemini-2.5-flash',
			AI_CHAT_API_KEY: 'google-test-secret',
		};
		const http = {
			post: jest.fn(() =>
				of({
					data: {
						candidates: [{ content: { parts: [{ text: 'Internal', thought: true }, { text: 'Hospital answer' }] } }],
					},
				}),
			),
		};
		const provider = new AiChatProvider({ get: (key: string) => values[key] } as any, http as any);
		expect(await provider.reply('instructions', 'question')).toBe('Hospital answer');
		expect(http.post).toHaveBeenCalledWith(
			'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
			expect.objectContaining({ generationConfig: { maxOutputTokens: 600, thinkingConfig: { thinkingBudget: 0 } } }),
			expect.objectContaining({ headers: { 'x-goog-api-key': 'google-test-secret' }, maxRedirects: 0 }),
		);
	});
	it('rejects model URLs and unsupported provider names before transmission', async () => {
		for (const extra of [{ AI_CHAT_MODEL: 'https://aistudio.google.com/models' }, { AI_CHAT_PROVIDER: 'unknown' }]) {
			const values = {
				AI_CHAT_PROVIDER: 'gemini',
				AI_CHAT_ENABLED: 'true',
				AI_CHAT_MODEL: 'gemini-2.5-flash',
				AI_CHAT_API_KEY: 'test-secret',
				...extra,
			};
			const http = { post: jest.fn() };
			const provider = new AiChatProvider({ get: (key: string) => values[key] } as any, http as any);
			expect(provider.isConfigured()).toBe(false);
			await expect(provider.reply('instructions', 'question')).rejects.toThrow('configuration');
			expect(http.post).not.toHaveBeenCalled();
		}
	});
});

it('keeps Gemini disabled until enabled after checking the project tariff', () => {
	const values = {
		AI_CHAT_PROVIDER: 'gemini',
		AI_CHAT_MODEL: 'gemini-2.5-flash',
		AI_CHAT_API_KEY: 'google-test-secret',
	};
	const provider = new AiChatProvider({ get: (key: string) => values[key] } as any, { post: jest.fn() } as any);
	expect(provider.isConfigured()).toBe(false);
});

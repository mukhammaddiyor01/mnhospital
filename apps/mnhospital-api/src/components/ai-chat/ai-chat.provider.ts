import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AiChatProvider {
	constructor(
		private readonly config: ConfigService,
		private readonly http: HttpService,
	) {}

	public isConfigured(): boolean {
		const provider = this.config.get<string>('AI_CHAT_PROVIDER') ?? 'openai';
		if (
			this.config.get<string>('AI_CHAT_ENABLED') === 'false' ||
			(provider === 'gemini' && this.config.get<string>('AI_CHAT_ENABLED') !== 'true')
		)
			return false;
		const model = this.config.get<string>('AI_CHAT_MODEL')?.trim();
		return Boolean(
			this.config.get<string>('AI_CHAT_API_KEY')?.trim() &&
			model &&
			/^[a-zA-Z0-9._:-]+$/.test(model) &&
			['openai', 'gemini'].includes(provider) &&
			(provider !== 'gemini' || model.startsWith('gemini-')),
		);
	}

	public async reply(instructions: string, question: string): Promise<string> {
		if (!this.isConfigured()) throw new Error('Assistant configuration is invalid');
		if (this.config.get<string>('AI_CHAT_PROVIDER') === 'gemini') return this.replyWithGemini(instructions, question);
		const response = await firstValueFrom(
			this.http.post(
				'https://api.openai.com/v1/chat/completions',
				{
					model: this.config.get<string>('AI_CHAT_MODEL'),
					store: false,
					max_completion_tokens: 600,
					messages: [
						{ role: 'system', content: instructions },
						{ role: 'user', content: question },
					],
				},
				{
					timeout: 20000,
					maxRedirects: 0,
					headers: { Authorization: `Bearer ${this.config.get<string>('AI_CHAT_API_KEY')}` },
				},
			),
		);
		const text = response.data?.choices?.[0]?.message?.content;
		if (typeof text !== 'string' || !text.trim()) throw new Error('Empty assistant reply');
		return text.trim().slice(0, 4000);
	}
	private async replyWithGemini(instructions: string, question: string): Promise<string> {
		const model = this.config.get<string>('AI_CHAT_MODEL').trim();
		const response = await firstValueFrom(
			this.http.post(
				`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
				{
					systemInstruction: { parts: [{ text: instructions }] },
					contents: [{ role: 'user', parts: [{ text: question }] }],
					generationConfig: {
						maxOutputTokens: 600,
						...(model === 'gemini-2.5-flash' || model === 'gemini-2.5-flash-lite'
							? { thinkingConfig: { thinkingBudget: 0 } }
							: {}),
					},
				},
				{ timeout: 20000, maxRedirects: 0, headers: { 'x-goog-api-key': this.config.get<string>('AI_CHAT_API_KEY') } },
			),
		);
		const text = response.data?.candidates?.[0]?.content?.parts
			?.filter((part: { text?: string; thought?: boolean }) => !part.thought && typeof part.text === 'string')
			.map((part: { text: string }) => part.text)
			.join('');
		if (!text?.trim()) throw new Error('Empty assistant reply');
		return text.trim().slice(0, 4000);
	}
}

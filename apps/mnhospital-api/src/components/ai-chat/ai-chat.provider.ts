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
		return Boolean(
			this.config.get<string>('AI_CHAT_API_KEY')?.trim() && this.config.get<string>('AI_CHAT_MODEL')?.trim(),
		);
	}

	public async reply(instructions: string, question: string): Promise<string> {
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
}

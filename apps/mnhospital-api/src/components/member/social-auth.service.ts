import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { MemberAuthType } from './enums/member.enum';
import { SocialAuthInput } from './dto/member.input';

export interface SocialProfile {
	provider: MemberAuthType;
	subject: string;
	fullName?: string;
	email?: string;
	image?: string;
}

@Injectable()
export class SocialAuthService {
	constructor(private readonly http: HttpService, private readonly config: ConfigService) {}

	public async authenticate(input: SocialAuthInput): Promise<SocialProfile> {
		if (![MemberAuthType.GOOGLE, MemberAuthType.NAVER, MemberAuthType.LINE].includes(input.provider)) {
			throw new BadRequestException('Unsupported social authentication provider.');
		}
		this.validateRedirectUri(input.redirectUri);

		try {
			switch (input.provider) {
				case MemberAuthType.GOOGLE: return await this.authenticateGoogle(input);
				case MemberAuthType.NAVER: return await this.authenticateNaver(input);
				case MemberAuthType.LINE: return await this.authenticateLine(input);
			}
		} catch (error) {
			if (error instanceof BadRequestException || error instanceof ServiceUnavailableException || error instanceof UnauthorizedException) throw error;
			throw new UnauthorizedException('The provider authorization could not be verified.');
		}
	}

	private value(name: string): string {
		const value = this.config.get<string>(name)?.trim();
		if (!value) throw new ServiceUnavailableException(`${name} is not configured.`);
		return value;
	}

	private validateRedirectUri(redirectUri: string) {
		const configured = this.config.get<string>('OAUTH_REDIRECT_URI')?.trim();
		const clientUrl = (this.config.get<string>('CLIENT_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
		const allowed = configured || `${clientUrl}/account/oauth/callback`;
		if (redirectUri !== allowed) throw new BadRequestException('OAuth redirect URI is not allowed.');
	}

	private async authenticateGoogle(input: SocialAuthInput): Promise<SocialProfile> {
		if (!input.codeVerifier) throw new BadRequestException('Google PKCE verifier is required.');
		const clientId = this.value('GOOGLE_CLIENT_ID');
		const body = new URLSearchParams({
			client_id: clientId,
			client_secret: this.value('GOOGLE_CLIENT_SECRET'),
			code: input.authorizationCode,
			code_verifier: input.codeVerifier,
			grant_type: 'authorization_code',
			redirect_uri: input.redirectUri,
		});
		const tokenResponse = await firstValueFrom(this.http.post('https://oauth2.googleapis.com/token', body.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }));
		const accessToken = tokenResponse.data?.access_token as string | undefined;
		if (!accessToken) throw new UnauthorizedException('Google did not return an access token.');

		const validation = await firstValueFrom(this.http.get('https://oauth2.googleapis.com/tokeninfo', { params: { access_token: accessToken } }));
		if (validation.data?.aud !== clientId || Number(validation.data?.expires_in ?? 0) <= 0) throw new UnauthorizedException('Google access token is invalid.');
		const response = await firstValueFrom(this.http.get('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } }));
		if (!response.data?.sub) throw new UnauthorizedException('Google profile is missing an identifier.');
		return {
			provider: MemberAuthType.GOOGLE,
			subject: String(response.data.sub),
			fullName: response.data.name,
			email: response.data.email_verified ? response.data.email?.toLowerCase() : undefined,
			image: response.data.picture,
		};
	}

	private async authenticateNaver(input: SocialAuthInput): Promise<SocialProfile> {
		const clientId = this.value('NAVER_CLIENT_ID');
		const clientSecret = this.value('NAVER_CLIENT_SECRET');
		const tokenResponse = await firstValueFrom(this.http.get('https://nid.naver.com/oauth2.0/token', { params: {
			grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret,
			code: input.authorizationCode, state: input.state,
		} }));
		const accessToken = tokenResponse.data?.access_token as string | undefined;
		if (!accessToken || tokenResponse.data?.error) throw new UnauthorizedException('Naver did not authorize this request.');
		const response = await firstValueFrom(this.http.get('https://openapi.naver.com/v1/nid/me', { headers: { Authorization: `Bearer ${accessToken}` } }));
		const profile = response.data?.response;
		if (response.data?.resultcode !== '00' || !profile?.id) throw new UnauthorizedException('Naver profile is missing an identifier.');
		return {
			provider: MemberAuthType.NAVER,
			subject: String(profile.id),
			fullName: profile.name || profile.nickname,
			email: profile.email?.toLowerCase(),
			image: profile.profile_image,
		};
	}

	private async authenticateLine(input: SocialAuthInput): Promise<SocialProfile> {
		if (!input.codeVerifier) throw new BadRequestException('LINE PKCE verifier is required.');
		const channelId = this.value('LINE_CHANNEL_ID');
		const body = new URLSearchParams({
			grant_type: 'authorization_code', code: input.authorizationCode, redirect_uri: input.redirectUri,
			client_id: channelId, client_secret: this.value('LINE_CHANNEL_SECRET'), code_verifier: input.codeVerifier,
		});
		const tokenResponse = await firstValueFrom(this.http.post('https://api.line.me/oauth2/v2.1/token', body.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }));
		const accessToken = tokenResponse.data?.access_token as string | undefined;
		if (!accessToken) throw new UnauthorizedException('LINE did not return an access token.');
		const validation = await firstValueFrom(this.http.get('https://api.line.me/oauth2/v2.1/verify', { params: { access_token: accessToken } }));
		if (String(validation.data?.client_id) !== channelId || Number(validation.data?.expires_in ?? 0) <= 0) throw new UnauthorizedException('LINE access token is invalid.');
		const response = await firstValueFrom(this.http.get('https://api.line.me/v2/profile', { headers: { Authorization: `Bearer ${accessToken}` } }));
		if (!response.data?.userId) throw new UnauthorizedException('LINE profile is missing an identifier.');
		return {
			provider: MemberAuthType.LINE,
			subject: String(response.data.userId),
			fullName: response.data.displayName,
			image: response.data.pictureUrl,
		};
	}
}

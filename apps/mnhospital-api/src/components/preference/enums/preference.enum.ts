import { registerEnumType } from '@nestjs/graphql';

export enum PreferenceTheme {
	LIGHT = 'LIGHT',
	DARK = 'DARK',
	SYSTEM = 'SYSTEM',
}
registerEnumType(PreferenceTheme, { name: 'PreferenceTheme' });

export enum PreferenceLanguage {
	KR = 'KR',
	UZ = 'UZ',
	EN = 'EN',
}
registerEnumType(PreferenceLanguage, { name: 'PreferenceLanguage' });

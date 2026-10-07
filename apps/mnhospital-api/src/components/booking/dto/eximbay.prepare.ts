import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class EximbayPaymentData {
	@Field(() => String)
	transaction_type: string;

	@Field(() => String)
	order_id: string;

	@Field(() => String)
	currency: string;

	@Field(() => String)
	amount: string;

	@Field(() => String)
	lang: string;
}

@ObjectType()
export class EximbayMerchantData {
	@Field(() => String)
	mid: string;
}

@ObjectType()
export class EximbayBuyerData {
	@Field(() => String)
	name: string;

	@Field(() => String)
	email: string;
}

@ObjectType()
export class EximbayUrlData {
	@Field(() => String)
	return_url: string;

	@Field(() => String)
	status_url: string;
}

@ObjectType()
export class EximbaySettingsData {
	@Field(() => String)
	display_type: string;
}

@ObjectType()
export class EximbayPrepare {
	@Field(() => String)
	fgkey: string;

	@Field(() => String)
	mid: string;

	@Field(() => EximbayPaymentData)
	payment: EximbayPaymentData;

	@Field(() => EximbayMerchantData)
	merchant: EximbayMerchantData;

	@Field(() => EximbayBuyerData)
	buyer: EximbayBuyerData;

	@Field(() => EximbayUrlData)
	url: EximbayUrlData;

	@Field(() => EximbaySettingsData)
	settings: EximbaySettingsData;
}

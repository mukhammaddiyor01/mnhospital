import { BadRequestException } from '@nestjs/common';

export interface PricedLine {
	serviceId: string;
	servicePrice: string;
	serviceBasePrice?: number;
	serviceDiscountAmount?: number;
	promoDiscountAmount?: number;
}
export interface PromoRule {
	discountType: string;
	discountValue: number;
	serviceIds?: string[];
}
export const currencyFactor = (currency: string) => (currency === 'KRW' ? 1 : 100);
export function discountedServicePrice(price: number, percent = 0, currency: string) {
	if (!Number.isFinite(price) || price < 0 || !Number.isFinite(percent) || percent < 0 || percent > 100)
		throw new BadRequestException('Invalid service discount');
	const factor = currencyFactor(currency);
	const base = Math.round(price * factor);
	if (!Number.isSafeInteger(base)) throw new BadRequestException('Service price is too large');
	const discount = Math.round((base * percent) / 100);
	return { base: base / factor, discount: discount / factor, total: (base - discount) / factor };
}

// Allocate promo rounding per line: payment intents always sum to the order total.
export function priceBookingLines<T extends PricedLine>(lines: T[], currency: string, promo?: PromoRule) {
	const factor = currencyFactor(currency);
	const priced = lines.map((line) => {
		const base = Number(line.serviceBasePrice ?? line.servicePrice);
		const serviceDiscount = Number(line.serviceDiscountAmount ?? 0);
		if (
			!Number.isFinite(base) ||
			base < 0 ||
			!Number.isFinite(serviceDiscount) ||
			serviceDiscount < 0 ||
			serviceDiscount > base
		)
			throw new BadRequestException('Invalid booking price');
		return { ...line, serviceBasePrice: base, serviceDiscountAmount: serviceDiscount, promoDiscountAmount: 0 };
	});
	const units = priced.map((line) => Math.round((line.serviceBasePrice - line.serviceDiscountAmount) * factor));
	const eligible = priced
		.map((line, index) => index)
		.filter((index) => !promo?.serviceIds?.length || promo.serviceIds.includes(priced[index].serviceId));
	const eligibleUnits = eligible.reduce((sum, i) => sum + units[i], 0);
	if (!Number.isSafeInteger(eligibleUnits) || units.some((value) => !Number.isSafeInteger(value)))
		throw new BadRequestException('Booking price is too large');
	let promoUnits = 0;
	if (promo) {
		if (
			!['PERCENT', 'FIXED'].includes(promo.discountType) ||
			!Number.isFinite(promo.discountValue) ||
			promo.discountValue <= 0 ||
			(promo.discountType === 'PERCENT' && promo.discountValue > 100)
		)
			throw new BadRequestException('Invalid promo discount');
		if (!eligibleUnits) throw new BadRequestException('Promo code does not apply to these services');
		promoUnits = Math.min(
			eligibleUnits,
			Math.round(
				promo.discountType === 'PERCENT' ? (eligibleUnits * promo.discountValue) / 100 : promo.discountValue * factor,
			),
		);
		if (promoUnits <= 0) throw new BadRequestException('Promo code produces no discount for this booking');
		const allocations = eligible.map((index) => {
			const weighted = BigInt(promoUnits) * BigInt(units[index]);
			return {
				index,
				share: Number(weighted / BigInt(eligibleUnits)),
				remainder: Number(weighted % BigInt(eligibleUnits)),
			};
		});
		let left = promoUnits - allocations.reduce((sum, entry) => sum + entry.share, 0);
		allocations.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
		for (const entry of allocations) {
			if (left > 0) {
				entry.share++;
				left--;
			}
			priced[entry.index].promoDiscountAmount = entry.share / factor;
		}
	}
	const items = priced.map((line, index) => ({
		...line,
		servicePrice: String((units[index] - Math.round(line.promoDiscountAmount * factor)) / factor),
	}));
	const subtotal = Math.round(priced.reduce((sum, line) => sum + line.serviceBasePrice, 0) * factor) / factor;
	const serviceDiscount =
		Math.round(priced.reduce((sum, line) => sum + line.serviceDiscountAmount, 0) * factor) / factor;
	const promoDiscount = promoUnits / factor;
	return {
		items,
		subtotal,
		serviceDiscount,
		promoDiscount,
		discount: Math.round((serviceDiscount + promoDiscount) * factor) / factor,
		total: Math.round(items.reduce((sum, line) => sum + Number(line.servicePrice), 0) * factor) / factor,
		eligibleSubtotal: eligibleUnits / factor,
	};
}

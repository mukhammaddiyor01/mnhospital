import { discountedServicePrice, priceBookingLines } from './pricing.policy';
describe('Hospital service discounts and promo allocation', () => {
	it('keeps the base price and rounds KRW to whole currency units', () => {
		expect(discountedServicePrice(101, 10, 'KRW')).toEqual({ base: 101, discount: 10, total: 91 });
		expect(() => discountedServicePrice(100, 101, 'UZS')).toThrow();
	});
	it('applies promo after the service discount and removes it without compounding', () => {
		const lines = [{ serviceId: 'a', servicePrice: '80', serviceBasePrice: 100, serviceDiscountAmount: 20 }];
		const priced = priceBookingLines(lines, 'UZS', { discountType: 'PERCENT', discountValue: 10 });
		expect(priced).toMatchObject({ subtotal: 100, serviceDiscount: 20, promoDiscount: 8, total: 72 });
		expect(priceBookingLines(priced.items, 'UZS').total).toBe(80);
		expect(priceBookingLines(priced.items, 'UZS', { discountType: 'PERCENT', discountValue: 10 }).total).toBe(72);
	});
	it('allocates fixed promo currency rounding so payment lines equal the total', () => {
		const lines = [1, 2, 3].map((i) => ({ serviceId: String(i), servicePrice: '10' }));
		const result = priceBookingLines(lines, 'KRW', { discountType: 'FIXED', discountValue: 1 });
		expect(result.items.map((i) => i.servicePrice)).toEqual(['9', '10', '10']);
		expect(result.items.reduce((sum, i) => sum + Number(i.servicePrice), 0)).toBe(result.total);
	});
	it('keeps combined discounts precise in currencies with fractional units', () => {
		const result = priceBookingLines(
			[{ serviceId: 'a', servicePrice: '0.90', serviceBasePrice: 1, serviceDiscountAmount: 0.1 }],
			'UZS',
			{ discountType: 'FIXED', discountValue: 0.2 },
		);
		expect(result.discount).toBe(0.3);
		expect(result.total).toBe(0.7);
	});
	it('restricts coupons to eligible services and caps discounts at the payable amount', () => {
		const lines = [
			{ serviceId: 'a', servicePrice: '80' },
			{ serviceId: 'b', servicePrice: '20' },
		];
		const result = priceBookingLines(lines, 'UZS', { discountType: 'FIXED', discountValue: 500, serviceIds: ['a'] });
		expect(result.total).toBe(20);
		expect(result.items[1].servicePrice).toBe('20');
		expect(() =>
			priceBookingLines(lines, 'UZS', { discountType: 'FIXED', discountValue: 10, serviceIds: ['c'] }),
		).toThrow();
	});
});

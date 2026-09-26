# Eximbay test payment: NestJS + NextJS

Bu oqim loyihadagi mavjud `BookingOrder` va line-level `Payment` mantiqini saqlaydi.
Bemor avval payment yaratadi, keyin shu payment uchun Eximbay oynasini ochadi.

## Environment

NestJS backend ishlayotgan serverning `.env` fayliga quyidagilarni qo‘shing:

```env
EXIMBAY_API_BASE=https://api-test.eximbay.com
EXIMBAY_API_KEY=test_1849705C642C217E0B2D
EXIMBAY_MID=1849705C64
BASE_URL=http://localhost:2001
CLIENT_URL=http://localhost:3000
```

`BASE_URL` Eximbay ko‘ra oladigan backend manzili bo‘lishi kerak. Local webhook testi uchun `ngrok` ishlatilsa, `BASE_URL` ngrok HTTPS URL’iga almashtiriladi.

## GraphQL oqimi

1. Bemor `createBookingOrder` orqali order yaratadi.
2. Order item’dagi `serviceId` va `doctorId` bilan `createPayment` chaqiriladi:

```graphql
mutation CreatePayment($input: PaymentInput!) {
  createPayment(input: $input) {
    _id
    providerPaymentId
    bookingOrderId
    paymentProvider
    paymentAmount
    paymentCurrency
    paymentStatus
  }
}
```

```json
{
  "input": {
    "bookingOrderId": "BOOKING_ORDER_ID",
    "serviceId": "SERVICE_ID",
    "doctorId": "DOCTOR_ID",
    "paymentProvider": "EXIMBAY",
    "paymentMethod": "CARD",
    "idempotencyKey": "patient-order-line-unique-key"
  }
}
```

3. `Payment._id` bilan Eximbay uchun `fgkey` olinadi:

```graphql
mutation PrepareEximbayPayment($input: EximbayPrepareInput!) {
  prepareEximbayPayment(input: $input) {
    fgkey
    mid
    payment {
      transaction_type
      order_id
      currency
      amount
      lang
    }
    merchant { mid }
    buyer { name email }
    url { return_url status_url }
  }
}
```

```json
{
  "input": {
    "paymentId": "PAYMENT_ID"
  }
}
```

`fgkey` faqat serverdan olinadi. Frontend amount yoki order qiymatini o‘zi hisoblab yubormaydi.

## NextJS client component

```tsx
'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    EXIMBAY?: {
      request_pay: (input: Record<string, unknown>) => void;
    };
  }
}

const SDK_URL = 'https://api-test.eximbay.com/v2/javascriptSDK.js';

export function EximbayPayButton({ paymentId }: { paymentId: string }) {
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (window.EXIMBAY?.request_pay) {
      setSdkReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => setSdkReady(true);
    document.body.appendChild(script);

    return () => script.remove();
  }, []);

  async function pay() {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
        },
        body: JSON.stringify({
          query: `mutation PrepareEximbayPayment($input: EximbayPrepareInput!) {
            prepareEximbayPayment(input: $input) {
              fgkey mid
              payment { transaction_type order_id currency amount lang }
              merchant { mid }
              buyer { name email }
              url { return_url status_url }
            }
          }`,
          variables: { input: { paymentId } },
        }),
      });

      const body = await response.json();
      if (body.errors?.length) throw new Error(body.errors[0].message);

      const data = body.data.prepareEximbayPayment;
      window.EXIMBAY?.request_pay({
        fgkey: data.fgkey,
        payment: data.payment,
        merchant: data.merchant,
        buyer: data.buyer,
        url: data.url,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" disabled={!sdkReady || loading} onClick={pay}>
      {loading ? 'Tayyorlanmoqda...' : 'Eximbay bilan to‘lash'}
    </button>
  );
}
```

NextJS `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:2001
```

Backend `return_url` foydalanuvchini `/booking/payment/:paymentId/success` yoki `/failed` sahifasiga qaytaradi. Bu sahifada payment status’ni `getMyPayment` bilan qayta o‘qing; browser callback’ning o‘zini “to‘landi” deb qabul qilmang.

Local `status_url` Eximbay serveridan `localhost`ga yetib kelmaydi. `return_url` local test uchun ishlaydi, to‘liq webhook testi uchun backendni ngrok orqali oching.

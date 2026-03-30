# @build-context/paygate

Browser-only Paygate SDK: fetches flows/gates from the same `/sdk/*` API, renders HTML in a fullscreen overlay, and bridges `paygate` WebKit messages via `postMessage`.

## Install

```bash
npm install @build-context/paygate
```

## Usage

```ts
import { Paygate } from '@build-context/paygate';

Paygate.initialize({
  apiKey: 'pk_...',
  baseURL: undefined, // optional override
  getActiveStoreProductIds: async () => [], // optional: skip paywall if user already owns SKUs
  onPurchaseRequest: async (productId) => ({ purchased: false }), // optional: Stripe, etc.
});

const result = await Paygate.launchGate('gate_...');
```

Without `onPurchaseRequest`, the paywall still works for close/skip/restore (if you provide `getActiveStoreProductIds`), but purchase taps show a short alert.

## Build

```bash
npm run build
```

Outputs CommonJS under `dist/` with TypeScript declarations.

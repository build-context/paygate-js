export const PAYGATE_API_VERSION = "2025-03-16";

export type PaygatePresentationStyle = "fullScreen" | "sheet";

/** Matches native SDK `PaygateLaunchStatus` string values (camelCase). */
export type PaygateLaunchStatus =
  | "purchased"
  | "alreadySubscribed"
  | "dismissed"
  | "skipped"
  | "channelNotEnabled"
  | "planLimitReached";

export interface PaygateLaunchResult {
  status: PaygateLaunchStatus;
  productId?: string;
  data?: Record<string, unknown>;
}

export interface FlowPage {
  id: string;
  htmlContent: string;
}

export interface ProductData {
  id: string;
  name: string;
  appStoreId?: string | null;
  playStoreId?: string | null;
}

export interface FlowData {
  id: string;
  name: string;
  pages: FlowPage[];
  bridgeScript: string;
  productIds: string[];
  products?: ProductData[] | null;
}

export interface GateFlowResponse {
  gateId: string;
  selectedFlowId: string;
  enabledChannels: string[];
  requirePurchase: boolean;
  launchCache: string;
  id: string;
  name: string;
  pages: FlowPage[];
  bridgeScript: string;
  productIds: string[];
  products?: ProductData[] | null;
}

export interface PaygateWebConfig {
  apiKey: string;
  baseURL?: string;
  /** Optional: return store product IDs the user already owns (App Store / Play) to skip the paywall. */
  getActiveStoreProductIds?: () => Promise<string[]>;
  /**
   * When the paywall requests a purchase, host handles payment (e.g. Stripe).
   * Return `{ purchased: true, storeProductId?: string }` to complete the flow.
   */
  onPurchaseRequest?: (productId: string) => Promise<{
    purchased: boolean;
    storeProductId?: string;
  }>;
}

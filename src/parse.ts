import type {
  FlowData,
  FlowPage,
  GateFlowResponse,
  ProductData,
} from "./types";

export function parseProductData(o: Record<string, unknown>): ProductData {
  return {
    id: String(o.id ?? ""),
    name: String(o.name ?? ""),
    appStoreId: (o.appStoreId as string) ?? null,
    playStoreId: (o.playStoreId as string) ?? null,
  };
}

export function parseFlowPage(o: Record<string, unknown>): FlowPage {
  return {
    id: String(o.id ?? ""),
    htmlContent: String(o.htmlContent ?? ""),
  };
}

export function parseFlowData(raw: Record<string, unknown>): FlowData {
  const pages = Array.isArray(raw.pages)
    ? (raw.pages as Record<string, unknown>[]).map(parseFlowPage)
    : [];
  const productIds = Array.isArray(raw.productIds)
    ? (raw.productIds as unknown[]).map(String)
    : [];
  const products = Array.isArray(raw.products)
    ? (raw.products as Record<string, unknown>[]).map(parseProductData)
    : null;
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    pages,
    bridgeScript: String(raw.bridgeScript ?? ""),
    productIds,
    products,
  };
}

export function parseGateFlowResponse(raw: Record<string, unknown>): GateFlowResponse {
  const flow = parseFlowData(raw);
  const enabledChannels = Array.isArray(raw.enabledChannels)
    ? (raw.enabledChannels as unknown[]).map(String)
    : [];
  let requirePurchase = false;
  const rp = raw.requirePurchase;
  if (typeof rp === "boolean") requirePurchase = rp;
  else if (typeof rp === "string") requirePurchase = rp.toLowerCase() === "true";
  return {
    gateId: String(raw.gateId ?? ""),
    selectedFlowId: String(raw.selectedFlowId ?? ""),
    enabledChannels,
    requirePurchase,
    launchCache: String(raw.launchCache ?? "cache_on_first_launch"),
    ...flow,
  };
}

export function storeIdsForFlow(flow: FlowData): string[] {
  const ids = new Set<string>();
  for (const p of flow.products ?? []) {
    if (p.appStoreId) ids.add(p.appStoreId);
    if (p.playStoreId) ids.add(p.playStoreId);
  }
  return [...ids];
}

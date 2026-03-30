import { GateSessionBuffer, trackFlowEvent } from "./analytics";
import { PaygateHttpError, paygateFetchJson } from "./http";
import { buildFlowDocumentHtml, openPaywallModal } from "./modal";
import {
  parseFlowData,
  parseGateFlowResponse,
  storeIdsForFlow,
} from "./parse";
import type {
  FlowData,
  GateFlowResponse,
  PaygateLaunchResult,
  PaygatePresentationStyle,
  PaygateWebConfig,
} from "./types";
import { PAYGATE_API_VERSION } from "./types";

const DEFAULT_BASE = "https://api-oh6xuuomca-uc.a.run.app";

function webChannel(): string {
  if (typeof window === "undefined") return "production";
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) {
    return "debug";
  }
  return "production";
}

let config: PaygateWebConfig | null = null;
let baseURL = DEFAULT_BASE;

function ensureInit(): PaygateWebConfig {
  if (!config) throw new Error("Call Paygate.initialize() first.");
  return config;
}

async function activeStoreOverlap(flow: FlowData): Promise<string | undefined> {
  const cfg = ensureInit();
  const activeFn = cfg.getActiveStoreProductIds;
  if (!activeFn) return undefined;
  const active = new Set((await activeFn()).filter(Boolean));
  if (active.size === 0) return undefined;
  for (const sid of storeIdsForFlow(flow)) {
    if (active.has(sid)) return sid;
  }
  return undefined;
}

async function runModalSession(
  flow: FlowData,
  options: {
    gateId?: string;
    requirePurchase?: boolean;
  }
): Promise<PaygateLaunchResult> {
  const cfg = ensureInit();
  const token = crypto.randomUUID();
  const html = buildFlowDocumentHtml(flow, token);
  const buffer = options.gateId
    ? new GateSessionBuffer(baseURL, cfg.apiKey, options.gateId, flow.id)
    : null;

  const finishGate = async (
    reason: string,
    terminal: string,
    meta: Record<string, string>,
    status: PaygateLaunchResult["status"],
    productId?: string,
    data?: Record<string, unknown>
  ) => {
    if (buffer) await buffer.finalize(reason, terminal, meta);
    return { status, productId, data } as PaygateLaunchResult;
  };

  for (;;) {
    const outcome = await openPaywallModal(html, token);
    switch (outcome.kind) {
      case "dismissed":
        buffer?.append("bridge_close", {});
        return finishGate("dismissed", "gate_dismissed", {}, "dismissed", undefined, outcome.data);
      case "skipped":
        buffer?.append("bridge_skip", {});
        if (options.requirePurchase) {
          return finishGate("dismissed", "gate_dismissed", {}, "dismissed", undefined, outcome.data);
        }
        return finishGate("skipped", "gate_skipped", {}, "skipped", undefined, outcome.data);
      case "restore": {
        buffer?.append("bridge_restore", {});
        const activeFn = cfg.getActiveStoreProductIds;
        if (activeFn) {
          const active = new Set(await activeFn());
          const map: Record<string, string> = {};
          for (const p of flow.products ?? []) {
            if (p.playStoreId) map[p.id] = p.playStoreId;
            if (p.appStoreId && !map[p.id]) map[p.id] = p.appStoreId;
          }
          for (const paygateId of flow.productIds) {
            const sid = map[paygateId] ?? paygateId;
            if (active.has(sid)) {
              buffer?.append("restore_completed", {
                productId: paygateId,
                storeProductId: sid,
              });
              if (!buffer) {
                trackFlowEvent(baseURL, cfg.apiKey, flow.id, "restore_completed", {
                  productId: paygateId,
                  storeProductId: sid,
                });
              }
              return finishGate(
                "purchased",
                "gate_purchased",
                { productId: sid },
                "purchased",
                sid,
                outcome.data
              );
            }
          }
        }
        buffer?.append("restore_no_entitlement", {});
        continue;
      }
      case "purchase": {
        if (buffer) {
          buffer.append("purchase_initiated", { productId: outcome.productId });
        } else {
          trackFlowEvent(baseURL, cfg.apiKey, flow.id, "purchase_initiated", {
            productId: outcome.productId,
          });
        }
        const onPurchase = cfg.onPurchaseRequest;
        if (!onPurchase) {
          window.alert(
            "Complete your purchase in the mobile app. Web checkout is not configured for this project."
          );
          continue;
        }
        const res = await onPurchase(outcome.productId);
        if (res.purchased) {
          const storeId = res.storeProductId ?? outcome.productId;
          if (buffer) {
            buffer.append("purchase_completed", { productId: storeId });
          } else {
            trackFlowEvent(baseURL, cfg.apiKey, flow.id, "purchase_completed", {
              productId: storeId,
            });
          }
          return finishGate(
            "purchased",
            "gate_purchased",
            { productId: storeId },
            "purchased",
            storeId,
            outcome.data
          );
        }
        continue;
      }
    }
  }
}

export class Paygate {
  static readonly apiVersion = PAYGATE_API_VERSION;

  static initialize(c: PaygateWebConfig): void {
    config = c;
    baseURL = (c.baseURL ?? DEFAULT_BASE).replace(/\/$/, "");
  }

  static async launchFlow(
    flowId: string,
    _opts?: { presentationStyle?: PaygatePresentationStyle }
  ): Promise<PaygateLaunchResult> {
    ensureInit();
    const cfg = config!;
    let raw: Record<string, unknown>;
    try {
      raw = await paygateFetchJson<Record<string, unknown>>(
        baseURL,
        cfg.apiKey,
        `/sdk/flows/${encodeURIComponent(flowId)}`
      );
    } catch (e) {
      if (e instanceof PaygateHttpError && e.code === "presentation_limit_exceeded") {
        return {
          status: "planLimitReached",
          data: { used: e.used, limit: e.limit },
        };
      }
      throw e;
    }
    const flow = parseFlowData(raw);
    const sid = await activeStoreOverlap(flow);
    if (sid) {
      return { status: "alreadySubscribed", productId: sid };
    }
    return runModalSession(flow, {});
  }

  static async launchGate(
    gateId: string,
    _opts?: { presentationStyle?: PaygatePresentationStyle }
  ): Promise<PaygateLaunchResult> {
    ensureInit();
    const cfg = config!;
    let raw: Record<string, unknown>;
    try {
      raw = await paygateFetchJson<Record<string, unknown>>(
        baseURL,
        cfg.apiKey,
        `/sdk/gates/${encodeURIComponent(gateId)}`
      );
    } catch (e) {
      if (e instanceof PaygateHttpError && e.code === "presentation_limit_exceeded") {
        return {
          status: "planLimitReached",
          data: { used: e.used, limit: e.limit },
        };
      }
      throw e;
    }
    const gate = parseGateFlowResponse(raw);
    if (gate.enabledChannels.length > 0) {
      const ch = webChannel();
      if (!gate.enabledChannels.includes(ch)) {
        return { status: "channelNotEnabled" };
      }
    }
    const flow: FlowData = {
      id: gate.id,
      name: gate.name,
      pages: gate.pages,
      bridgeScript: gate.bridgeScript,
      productIds: gate.productIds,
      products: gate.products,
    };
    const sid = await activeStoreOverlap(flow);
    if (sid) {
      return { status: "alreadySubscribed", productId: sid };
    }
    return runModalSession(flow, {
      gateId: gate.gateId,
      requirePurchase: gate.requirePurchase,
    });
  }
}

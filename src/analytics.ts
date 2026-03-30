import { paygatePostJson } from "./http";

export interface PresentationEvent {
  eventType: string;
  occurredAt: number;
  metadata: Record<string, string>;
}

export interface PendingPresentation {
  clientBatchId: string;
  gateId: string;
  flowId: string;
  openedAt: number;
  closedAt?: number;
  dismissReason?: string;
  events: PresentationEvent[];
}

export class GateSessionBuffer {
  private pending: PendingPresentation;

  constructor(
    private readonly baseURL: string,
    private readonly apiKey: string,
    gateId: string,
    flowId: string
  ) {
    const openedAt = Date.now();
    this.pending = {
      clientBatchId: crypto.randomUUID(),
      gateId,
      flowId,
      openedAt,
      events: [
        {
          eventType: "gate_opened",
          occurredAt: openedAt,
          metadata: { gateId, flowId },
        },
      ],
    };
  }

  append(eventType: string, metadata: Record<string, string> = {}) {
    this.pending.events.push({
      eventType,
      occurredAt: Date.now(),
      metadata,
    });
  }

  async finalize(
    reason: string,
    terminalType: string,
    terminalMeta: Record<string, string> = {}
  ): Promise<void> {
    const now = Date.now();
    this.pending.closedAt = now;
    this.pending.dismissReason = reason;
    this.pending.events.push({
      eventType: terminalType,
      occurredAt: now,
      metadata: terminalMeta,
    });
    await paygatePostJson(this.baseURL, this.apiKey, "/sdk/presentations", this.pending);
  }
}

export function trackFlowEvent(
  baseURL: string,
  apiKey: string,
  flowId: string,
  eventType: string,
  metadata: Record<string, string>
): void {
  void paygatePostJson(baseURL, apiKey, `/sdk/flows/${encodeURIComponent(flowId)}/events`, {
    eventType,
    metadata,
  });
}

import { buildFlowDocumentHtml as buildDoc } from "./buildHtml";

export type BridgeMessage = {
  action: string;
  productId?: string;
  data?: Record<string, unknown>;
};

export type ModalOutcome =
  | { kind: "dismissed"; data?: Record<string, unknown> }
  | { kind: "skipped"; data?: Record<string, unknown> }
  | { kind: "purchase"; productId: string; data?: Record<string, unknown> }
  | { kind: "restore"; data?: Record<string, unknown> };

/**
 * Full-screen overlay + iframe (blob URL) hosting flow HTML with WebKit bridge shim.
 */
export function openPaywallModal(
  fullHtml: string,
  token: string
): Promise<ModalOutcome> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.setAttribute("data-paygate-overlay", "1");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483646",
      background: "rgba(0,0,0,0.92)",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "stretch",
    } as CSSStyleDeclaration);

    const iframe = document.createElement("iframe");
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
    );
    Object.assign(iframe.style, {
      flex: "1",
      width: "100%",
      border: "none",
      background: "transparent",
    } as CSSStyleDeclaration);

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      URL.revokeObjectURL(blobUrl);
      overlay.remove();
    };

    const onMessage = (ev: MessageEvent) => {
      const d = ev.data;
      if (!d || typeof d !== "object") return;
      if ((d as { __paygate?: boolean }).__paygate !== true) return;
      if ((d as { token?: string }).token !== token) return;
      const payload = (d as { payload?: BridgeMessage }).payload;
      if (!payload || typeof payload.action !== "string") return;

      switch (payload.action) {
        case "close":
          cleanup();
          resolve({ kind: "dismissed", data: payload.data });
          break;
        case "skip":
          cleanup();
          resolve({ kind: "skipped", data: payload.data });
          break;
        case "purchase":
          if (payload.productId) {
            cleanup();
            resolve({
              kind: "purchase",
              productId: String(payload.productId),
              data: payload.data,
            });
          }
          break;
        case "restore":
          cleanup();
          resolve({ kind: "restore", data: payload.data });
          break;
        default:
          break;
      }
    };

    window.addEventListener("message", onMessage);

    const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    iframe.src = blobUrl;

    overlay.appendChild(iframe);
    document.body.appendChild(overlay);
  });
}

export function buildFlowDocumentHtml(
  flow: {
    pages: { id: string; htmlContent: string }[];
    bridgeScript: string;
  },
  token: string
): string {
  return buildDoc(flow, token, "iframe");
}

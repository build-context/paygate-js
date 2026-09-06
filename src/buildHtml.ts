import type { FlowData, PaygateAppearance } from "./types";

/**
 * HTML document for embedded paywall (iframe or React Native WebView).
 *
 * `appearance` is applied two ways, because a browser owns
 * `prefers-color-scheme` and a document cannot change what it matches:
 *
 * - `color-scheme` on the root, which fixes UA-rendered widgets, form
 *   controls, scrollbars and the canvas background.
 * - `data-paygate-appearance` on `<html>`, so flow CSS can opt in with
 *   `:root[data-paygate-appearance="dark"]` rules.
 *
 * Flows that style themselves only through `@media (prefers-color-scheme: …)`
 * still follow the browser here. The native SDKs pin the WebView itself, so
 * those media queries do move there.
 */
export function buildFlowDocumentHtml(
  flow: Pick<FlowData, "pages" | "bridgeScript">,
  token: string,
  bridgeMode: "iframe" | "react-native-webview",
  appearance: PaygateAppearance = "system"
): string {
  const pageDivs = flow.pages
    .map((page, i) => {
      const hidden = i > 0 ? ' style="display:none"' : "";
      return `<div id="page_${page.id}" class="paygate-page"${hidden}>${page.htmlContent}</div>`;
    })
    .join("\n");

  const shim =
    bridgeMode === "iframe"
      ? `
(function(){
  var TOKEN = ${JSON.stringify(token)};
  window.webkit = window.webkit || {};
  window.webkit.messageHandlers = window.webkit.messageHandlers || {};
  window.webkit.messageHandlers.paygate = {
    postMessage: function(msg) {
      try {
        window.parent.postMessage({ __paygate: true, token: TOKEN, payload: msg }, '*');
      } catch(e) {}
    }
  };
})();
      `.trim()
      : `
(function(){
  window.webkit = window.webkit || {};
  window.webkit.messageHandlers = window.webkit.messageHandlers || {};
  window.webkit.messageHandlers.paygate = {
    postMessage: function(msg) {
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        }
      } catch(e) {}
    }
  };
})();
      `.trim();

  // "system" is left entirely alone rather than emitted as `light dark`, so a
  // flow that never opted into this renders byte-for-byte as it did before.
  const appearanceAttr =
    appearance === "system" ? "" : ` data-paygate-appearance="${appearance}"`;
  const colorSchemeMeta =
    appearance === "system"
      ? ""
      : `\n<meta name="color-scheme" content="${appearance}">`;

  return `<!DOCTYPE html>
<html lang="en"${appearanceAttr}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">${colorSchemeMeta}
<title>Flow</title>
<style>* { -webkit-user-select: none !important; user-select: none !important; }</style>
</head>
<body>
${pageDivs}
<script>${shim}</script>
${flow.bridgeScript}
</body>
</html>`;
}

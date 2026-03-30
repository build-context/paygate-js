import type { FlowData } from "./types";

/** HTML document for embedded paywall (iframe or React Native WebView). */
export function buildFlowDocumentHtml(
  flow: Pick<FlowData, "pages" | "bridgeScript">,
  token: string,
  bridgeMode: "iframe" | "react-native-webview"
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
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

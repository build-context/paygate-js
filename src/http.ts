import { PAYGATE_API_VERSION } from "./types";

export class PaygateHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly used?: number,
    public readonly limit?: number
  ) {
    super(message);
    this.name = "PaygateHttpError";
  }
}

export async function paygateFetchJson<T>(
  baseURL: string,
  apiKey: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${baseURL.replace(/\/$/, "")}${path}`;
  const headers: Record<string, string> = {
    "X-API-Key": apiKey,
    "Paygate-Version": PAYGATE_API_VERSION,
    ...(init?.headers as Record<string, string>),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (res.status === 403 && body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    if (o.code === "presentation_limit_exceeded") {
      throw new PaygateHttpError(
        "Presentation limit exceeded",
        403,
        "presentation_limit_exceeded",
        typeof o.used === "number" ? o.used : undefined,
        typeof o.limit === "number" ? o.limit : undefined
      );
    }
  }

  if (!res.ok) {
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const detail =
      (typeof o.detail === "string" && o.detail) ||
      (typeof o.error === "string" && o.error) ||
      res.statusText;
    throw new PaygateHttpError(detail || `HTTP ${res.status}`, res.status);
  }

  return body as T;
}

export async function paygatePostJson(
  baseURL: string,
  apiKey: string,
  path: string,
  jsonBody: unknown
): Promise<boolean> {
  const url = `${baseURL.replace(/\/$/, "")}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "Paygate-Version": PAYGATE_API_VERSION,
      },
      body: JSON.stringify(jsonBody),
    });
    return res.ok;
  } catch {
    return false;
  }
}

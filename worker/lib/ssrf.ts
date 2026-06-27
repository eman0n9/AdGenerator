/**
 * Basic SSRF protection for user-supplied URLs.
 *
 * The fetch target comes straight from the user, so before we (or a headless
 * browser) request it we reject non-http(s) schemes and hostnames that resolve
 * to private / loopback / link-local space or cloud metadata endpoints.
 *
 * Note: this is hostname-level filtering. A fully robust guard also re-checks
 * the resolved IP after DNS and pins the connection — see README "deferred".
 */

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
]);

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  return false;
}

export interface SsrfResult {
  ok: boolean;
  reason?: string;
}

export function validateUrl(raw: string): SsrfResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Not a valid URL." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: `Unsupported scheme "${url.protocol}".` };
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (BLOCKED_HOSTS.has(host)) {
    return { ok: false, reason: "Host is not allowed." };
  }
  if (isPrivateIPv4(host)) {
    return { ok: false, reason: "URL points to a private/internal address." };
  }
  // IPv6 loopback / unique-local / link-local.
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
    return { ok: false, reason: "URL points to a private/internal address." };
  }

  return { ok: true };
}

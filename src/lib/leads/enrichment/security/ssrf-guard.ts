/**
 * SSRF (Server-Side Request Forgery) Security Guard
 * Ensures external web inspection for domain enrichment cannot target internal services or loopback/private IPs.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'instance-data',
  'metadata.google.internal',
]);

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.corp', '.home', '.lan'];

/**
 * Checks if an IP string is within a private, loopback, or cloud-metadata range.
 */
export function isPrivateOrReservedIP(ip: string): boolean {
  // IPv4 Loopback (127.0.0.0/8)
  if (/^127\./.test(ip)) return true;

  // Zero network (0.0.0.0/8)
  if (/^0\./.test(ip)) return true;

  // RFC 1918 Private ranges:
  // 10.0.0.0 - 10.255.255.255 (10.0.0.0/8)
  if (/^10\./.test(ip)) return true;

  // 172.16.0.0 - 172.31.255.255 (172.16.0.0/12)
  const match172 = ip.match(/^172\.(\d+)\./);
  if (match172) {
    const secondOctet = parseInt(match172[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }

  // 192.168.0.0 - 192.168.255.255 (192.168.0.0/16)
  if (/^192\.168\./.test(ip)) return true;

  // Cloud Instance Metadata Service & Link-Local (169.254.0.0/16)
  if (/^169\.254\./.test(ip)) return true;

  // IPv6 loopback and private/unique-local/link-local
  if (ip === '::1' || ip === '::' || /^fe80:/i.test(ip) || /^fc00:/i.test(ip) || /^fd/i.test(ip)) {
    return true;
  }

  return false;
}

/**
 * Validates a target URL string before any outbound network request is dispatched.
 */
export function validateSafeUrl(targetUrl: string): { valid: boolean; error?: string; sanitizedUrl?: URL } {
  try {
    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      // Prepend https:// if missing scheme
      parsed = new URL(`https://${targetUrl}`);
    }

    // Protocol check: only http: and https: are allowed
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: `Disallowed protocol: ${parsed.protocol}. Only http: and https: are permitted.` };
    }

    const rawHostname = parsed.hostname.toLowerCase();
    const cleanHostname = rawHostname.replace(/^\[|\]$/g, '');

    // Check blocked hostnames
    if (BLOCKED_HOSTNAMES.has(cleanHostname) || BLOCKED_HOSTNAMES.has(rawHostname)) {
      return { valid: false, error: `Access to blocked host '${cleanHostname}' is prohibited (SSRF prevention).` };
    }

    // Check blocked domain suffixes
    for (const suffix of BLOCKED_SUFFIXES) {
      if (cleanHostname.endsWith(suffix)) {
        return { valid: false, error: `Access to private/internal domain suffix '${suffix}' is prohibited.` };
      }
    }

    // Check IP address patterns directly
    if (isPrivateOrReservedIP(cleanHostname)) {
      return { valid: false, error: `Access to private or reserved IP address '${cleanHostname}' is prohibited.` };
    }

    return { valid: true, sanitizedUrl: parsed };
  } catch (err: any) {
    return { valid: false, error: `Invalid URL format: ${err.message}` };
  }
}

/**
 * Safely fetches public website metadata with timeout, redirect limit, and payload size guardrails.
 */
export async function safeFetchHtml(
  targetUrl: string,
  options: { timeoutMs?: number; maxBytes?: number } = {}
): Promise<{ ok: boolean; status?: number; html?: string; headers?: Record<string, string>; error?: string }> {
  const timeoutMs = options.timeoutMs || 4000;
  const maxBytes = options.maxBytes || 512 * 1024; // 512 KB limit

  const validation = validateSafeUrl(targetUrl);
  if (!validation.valid || !validation.sanitizedUrl) {
    return { ok: false, error: validation.error || 'URL validation failed' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(validation.sanitizedUrl.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'LeadMachine-Enrichment-Bot/1.0 (+https://leadmachine.io/bot)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      // Not HTML, return headers only
      const headerMap: Record<string, string> = {};
      response.headers.forEach((v, k) => {
        headerMap[k.toLowerCase()] = v;
      });
      return { ok: true, status: response.status, headers: headerMap, html: '' };
    }

    // Read limited bytes to prevent memory exhaustion
    const reader = response.body?.getReader();
    if (!reader) {
      const text = await response.text();
      return { ok: true, status: response.status, html: text.slice(0, maxBytes) };
    }

    let receivedBytes = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        receivedBytes += value.length;
        chunks.push(value);
        if (receivedBytes >= maxBytes) {
          reader.cancel();
          break;
        }
      }
    }

    const totalBuffer = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      totalBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    const html = new TextDecoder('utf-8').decode(totalBuffer);
    const headerMap: Record<string, string> = {};
    response.headers.forEach((v, k) => {
      headerMap[k.toLowerCase()] = v;
    });

    return { ok: true, status: response.status, html, headers: headerMap };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { ok: false, error: `Request timed out after ${timeoutMs}ms` };
    }
    return { ok: false, error: `Network error: ${err.message}` };
  }
}

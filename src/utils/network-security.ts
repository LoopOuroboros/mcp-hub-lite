/**
 * CIDR-based IP allowlist matching utility.
 * Zero dependencies — pure functions operating on IPv4 dotted-decimal strings.
 */

/**
 * Convert dotted-decimal IPv4 string to a 32-bit unsigned integer.
 * Returns NaN for invalid inputs.
 */
export function ip4ToInt(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) return NaN;

  let result = 0;
  for (const part of parts) {
    const octet = parseInt(part, 10);
    if (octet < 0 || octet > 255 || String(octet) !== part) return NaN;
    result = ((result << 8) | octet) >>> 0;
  }
  return result;
}

/**
 * Normalize an IP string for IPv4 CIDR matching.
 * - Strips "::ffff:" prefix from IPv4-mapped IPv6 addresses
 * - Maps "::1" (IPv6 loopback) to "127.0.0.1"
 * - Returns other values unchanged
 */
export function normalizeIp(ip: string): string {
  if (!ip) return ip;
  if (ip === '::1') return '127.0.0.1';
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

function cidrMask(prefix: number): number {
  if (prefix <= 0) return 0;
  if (prefix >= 32) return 0xffffffff >>> 0;
  return (~0 << (32 - prefix)) >>> 0;
}

/**
 * Parse a CIDR string "x.x.x.x/prefix" into network and mask.
 * If no prefix is provided, assume /32 (single host).
 * Returns null for invalid input.
 */
export function parseCidr(cidr: string): { network: number; mask: number } | null {
  if (!cidr) return null;

  const slashIdx = cidr.indexOf('/');
  const ipPart = slashIdx === -1 ? cidr : cidr.slice(0, slashIdx);
  const prefixPart = slashIdx === -1 ? '32' : cidr.slice(slashIdx + 1);

  const ip = ip4ToInt(ipPart);
  if (isNaN(ip)) return null;

  const prefix = parseInt(prefixPart, 10);
  if (isNaN(prefix) || String(prefix) !== prefixPart || prefix < 0 || prefix > 32) return null;

  const mask = cidrMask(prefix);
  return { network: (ip & mask) >>> 0, mask };
}

/**
 * Check whether an IP address is allowed by any CIDR in the allowlist.
 * - Empty/null/undefined list → true (allow all)
 * - Invalid IP → false (block, safety default)
 * - Invalid CIDR entries in the list are silently skipped
 */
export function isIpAllowed(ip: string, allowedNetworks: string[]): boolean {
  if (!allowedNetworks || allowedNetworks.length === 0) return true;

  const normalized = normalizeIp(ip);
  const ipInt = ip4ToInt(normalized);
  if (isNaN(ipInt)) return false;

  for (const cidr of allowedNetworks) {
    const parsed = parseCidr(cidr);
    if (parsed && (ipInt & parsed.mask) >>> 0 === parsed.network) return true;
  }
  return false;
}

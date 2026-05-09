import { describe, it, expect } from 'vitest';
import { ip4ToInt, normalizeIp, parseCidr, isIpAllowed } from '@utils/network-security.js';

describe('network-security', () => {
  describe('ip4ToInt', () => {
    it('should convert standard IPv4 to 32-bit integer', () => {
      expect(ip4ToInt('192.168.1.1')).toBe(0xc0a80101);
      expect(ip4ToInt('0.0.0.0')).toBe(0);
      expect(ip4ToInt('255.255.255.255')).toBe(0xffffffff >>> 0);
      expect(ip4ToInt('127.0.0.1')).toBe(0x7f000001);
      expect(ip4ToInt('10.0.0.0')).toBe(0x0a000000);
    });

    it('should return NaN for invalid format', () => {
      expect(ip4ToInt('')).toBeNaN();
      expect(ip4ToInt('abc')).toBeNaN();
      expect(ip4ToInt('1.2.3.4.5')).toBeNaN();
      expect(ip4ToInt('1.2.3')).toBeNaN();
    });

    it('should return NaN for out-of-range octets', () => {
      expect(ip4ToInt('256.1.1.1')).toBeNaN();
      expect(ip4ToInt('1.1.1.-1')).toBeNaN();
      expect(ip4ToInt('1.1.1.999')).toBeNaN();
    });

    it('should return NaN for non-numeric octets', () => {
      expect(ip4ToInt('1.2.3.abc')).toBeNaN();
      expect(ip4ToInt('1.2.3.1.1')).toBeNaN();
    });
  });

  describe('normalizeIp', () => {
    it('should return IPv4 unchanged', () => {
      expect(normalizeIp('192.168.1.1')).toBe('192.168.1.1');
      expect(normalizeIp('127.0.0.1')).toBe('127.0.0.1');
    });

    it('should strip ::ffff: prefix from IPv4-mapped IPv6', () => {
      expect(normalizeIp('::ffff:192.168.1.1')).toBe('192.168.1.1');
      expect(normalizeIp('::ffff:127.0.0.1')).toBe('127.0.0.1');
      expect(normalizeIp('::ffff:10.0.0.1')).toBe('10.0.0.1');
    });

    it('should map ::1 to 127.0.0.1', () => {
      expect(normalizeIp('::1')).toBe('127.0.0.1');
    });

    it('should return bare IPv6 unchanged', () => {
      expect(normalizeIp('fe80::1')).toBe('fe80::1');
      expect(normalizeIp('::1:2:3:4')).toBe('::1:2:3:4');
    });

    it('should handle empty/falsy values', () => {
      expect(normalizeIp('')).toBe('');
    });
  });

  describe('parseCidr', () => {
    it('should parse standard CIDR notation', () => {
      const result = parseCidr('192.168.1.0/24');
      expect(result).not.toBeNull();
      expect(result!.network).toBe(0xc0a80100);
      expect(result!.mask).toBe(0xffffff00);
    });

    it('should handle /32 prefix (single host)', () => {
      const result = parseCidr('10.0.0.1/32');
      expect(result).not.toBeNull();
      expect(result!.network).toBe(0x0a000001);
      expect(result!.mask).toBe(0xffffffff);
    });

    it('should handle /0 prefix (match all)', () => {
      const result = parseCidr('0.0.0.0/0');
      expect(result).not.toBeNull();
      expect(result!.mask).toBe(0);
    });

    it('should assume /32 when no prefix given', () => {
      const result = parseCidr('192.168.1.1');
      expect(result).not.toBeNull();
      expect(result!.network).toBe(0xc0a80101);
      expect(result!.mask).toBe(0xffffffff);
    });

    it('should return null for invalid prefix', () => {
      expect(parseCidr('192.168.1.0/33')).toBeNull();
      expect(parseCidr('192.168.1.0/-1')).toBeNull();
      expect(parseCidr('192.168.1.0/abc')).toBeNull();
    });

    it('should return null for invalid IP in CIDR', () => {
      expect(parseCidr('256.1.1.0/24')).toBeNull();
      expect(parseCidr('abc/24')).toBeNull();
    });

    it('should return null for empty or null input', () => {
      expect(parseCidr('')).toBeNull();
    });
  });

  describe('isIpAllowed', () => {
    const defaults = ['127.0.0.1', '192.168.0.0/16', '10.0.0.0/8'];

    it('should allow IP matching a CIDR', () => {
      expect(isIpAllowed('192.168.1.1', defaults)).toBe(true);
      expect(isIpAllowed('10.0.0.1', defaults)).toBe(true);
      expect(isIpAllowed('10.255.255.255', defaults)).toBe(true);
    });

    it('should reject IP not matching any CIDR', () => {
      expect(isIpAllowed('1.2.3.4', defaults)).toBe(false);
      expect(isIpAllowed('8.8.8.8', defaults)).toBe(false);
    });

    it('should allow all when list is empty', () => {
      expect(isIpAllowed('1.2.3.4', [])).toBe(true);
      expect(isIpAllowed('8.8.8.8', [])).toBe(true);
    });

    it('should reject invalid IPs (safety default)', () => {
      expect(isIpAllowed('', defaults)).toBe(false);
      expect(isIpAllowed('invalid', defaults)).toBe(false);
      expect(isIpAllowed('256.1.1.1', defaults)).toBe(false);
    });

    it('should match IPv4-mapped IPv6 addresses', () => {
      expect(isIpAllowed('::ffff:192.168.1.1', defaults)).toBe(true);
      expect(isIpAllowed('::ffff:10.0.0.1', defaults)).toBe(true);
      expect(isIpAllowed('::ffff:1.2.3.4', defaults)).toBe(false);
    });

    it('should match ::1 as localhost', () => {
      expect(isIpAllowed('::1', defaults)).toBe(true);
    });

    it('should skip invalid CIDR entries silently', () => {
      expect(isIpAllowed('192.168.1.1', ['invalid/24', '192.168.0.0/16'])).toBe(true);
      expect(isIpAllowed('1.2.3.4', ['invalid/24'])).toBe(false);
    });

    it('should handle /32 exact match', () => {
      expect(isIpAllowed('192.168.1.1', ['192.168.1.1/32'])).toBe(true);
      expect(isIpAllowed('192.168.1.2', ['192.168.1.1/32'])).toBe(false);
    });
  });
});

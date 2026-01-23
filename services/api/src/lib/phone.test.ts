/**
 * Phone Normalization Tests
 * Run with: npx vitest run src/lib/phone.test.ts
 */

import { describe, it, expect } from 'vitest';

import { normalizePhone, isValidE164, getCountryFromPhone, formatPhoneDisplay } from './phone.js';

describe('normalizePhone', () => {
  describe('Côte d\'Ivoire numbers (+225)', () => {
    it('should normalize 10-digit local number with leading 0', () => {
      // CI format: 0X XX XX XX XX (10 digits) -> +225 + 9 digits
      expect(normalizePhone('0707123456')).toBe('+225707123456');
    });

    it('should normalize 9-digit without leading 0', () => {
      expect(normalizePhone('707123456')).toBe('+225707123456');
    });

    it('should handle number with spaces', () => {
      expect(normalizePhone('07 07 12 34 56')).toBe('+225707123456');
    });

    it('should handle number with dashes', () => {
      expect(normalizePhone('07-07-12-34-56')).toBe('+225707123456');
    });

    it('should pass through valid E.164', () => {
      expect(normalizePhone('+225707123456')).toBe('+225707123456');
    });

    it('should handle 00 prefix', () => {
      expect(normalizePhone('00225707123456')).toBe('+225707123456');
    });

    it('should handle legacy 8-digit format', () => {
      // 07123456 -> remove leading 0 -> 7123456 (7 digits) -> +225 + 7123456
      expect(normalizePhone('07123456', 'CI')).toBe('+2257123456');
    });
  });

  describe('Other countries', () => {
    it('should normalize Senegal number', () => {
      expect(normalizePhone('771234567', 'SN')).toBe('+221771234567');
    });

    it('should normalize French number', () => {
      expect(normalizePhone('0612345678', 'FR')).toBe('+33612345678');
    });
  });

  describe('Error cases', () => {
    it('should throw on empty phone', () => {
      expect(() => normalizePhone('')).toThrow('Phone number is required');
    });

    it('should throw on unsupported country', () => {
      expect(() => normalizePhone('123456', 'XX')).toThrow('Unsupported country');
    });

    it('should throw on invalid format', () => {
      expect(() => normalizePhone('123')).toThrow('Invalid phone number format');
    });
  });
});

describe('isValidE164', () => {
  it('should validate correct E.164 numbers', () => {
    expect(isValidE164('+2250707123456')).toBe(true);
    expect(isValidE164('+33612345678')).toBe(true);
    expect(isValidE164('+1234567890')).toBe(true);
  });

  it('should reject invalid formats', () => {
    expect(isValidE164('0707123456')).toBe(false);
    expect(isValidE164('+0123456789')).toBe(false);
    expect(isValidE164('225123456')).toBe(false);
    expect(isValidE164('+12345')).toBe(false);
  });
});

describe('getCountryFromPhone', () => {
  it('should detect Côte d\'Ivoire', () => {
    expect(getCountryFromPhone('+2250707123456')).toBe('CI');
  });

  it('should detect Senegal', () => {
    expect(getCountryFromPhone('+221771234567')).toBe('SN');
  });

  it('should detect France', () => {
    expect(getCountryFromPhone('+33612345678')).toBe('FR');
  });

  it('should return null for unknown', () => {
    expect(getCountryFromPhone('+9991234567890')).toBe(null);
  });

  it('should return null for invalid E.164', () => {
    expect(getCountryFromPhone('0707123456')).toBe(null);
  });
});

describe('formatPhoneDisplay', () => {
  it('should format CI number with spaces', () => {
    expect(formatPhoneDisplay('+2250707123456')).toBe('+225 07 07 12 34 56');
  });

  it('should return invalid numbers as-is', () => {
    expect(formatPhoneDisplay('invalid')).toBe('invalid');
  });
});

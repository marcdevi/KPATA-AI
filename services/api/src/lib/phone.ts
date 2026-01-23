/**
 * Phone Number Utilities for KPATA AI
 * E.164 normalization and validation
 */

import { BadRequestError } from './errors.js';

const COUNTRY_CODES: Record<string, string> = {
  CI: '+225', // Côte d'Ivoire
  SN: '+221', // Senegal
  ML: '+223', // Mali
  BF: '+226', // Burkina Faso
  GN: '+224', // Guinea
  TG: '+228', // Togo
  BJ: '+229', // Benin
  NE: '+227', // Niger
  CM: '+237', // Cameroon
  GA: '+241', // Gabon
  CG: '+242', // Congo
  CD: '+243', // DRC
  FR: '+33',  // France
};

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

/**
 * Normalize a phone number to E.164 format
 * Supports Côte d'Ivoire (+225) as default country
 * 
 * @param phone - Phone number in various formats
 * @param defaultCountry - Default country code (ISO 3166-1 alpha-2)
 * @returns Normalized E.164 phone number
 * @throws BadRequestError if phone cannot be normalized
 */
export function normalizePhone(phone: string, defaultCountry = 'CI'): string {
  if (!phone) {
    throw new BadRequestError('Phone number is required');
  }

  // Remove all non-digit characters except leading +
  let cleaned = phone.trim();
  const hasPlus = cleaned.startsWith('+');
  cleaned = cleaned.replace(/\D/g, '');

  // If it had a +, add it back
  if (hasPlus) {
    cleaned = '+' + cleaned;
  }

  // Already in E.164 format
  if (E164_REGEX.test(cleaned)) {
    return cleaned;
  }

  // Handle 00 prefix (international format)
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
    if (E164_REGEX.test(cleaned)) {
      return cleaned;
    }
  }

  // Get default country code
  const countryCode = COUNTRY_CODES[defaultCountry];
  if (!countryCode) {
    throw new BadRequestError(`Unsupported country: ${defaultCountry}`);
  }

  // Handle local numbers (Côte d'Ivoire)
  // CI numbers: 10 digits with leading 0 (0707123456) -> 9 digits without 0
  // New format since 2021: 10 digits total (0X XX XX XX XX)
  // Legacy format: 8 digits total (0X XX XX XX) -> 7 digits without 0
  if (defaultCountry === 'CI') {
    // Remove leading 0 if present
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
    }
    // CI numbers are 9 digits without leading 0 (new format)
    // or 7 digits without leading 0 (legacy 8-digit format)
    if (cleaned.length === 9 || cleaned.length === 7) {
      cleaned = countryCode + cleaned;
    }
  } else {
    // Generic handling for other countries
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
    }
    cleaned = countryCode + cleaned;
  }

  // Final validation
  if (!E164_REGEX.test(cleaned)) {
    throw new BadRequestError(`Invalid phone number format: ${phone}`);
  }

  return cleaned;
}

/**
 * Validate that a phone number is in E.164 format
 */
export function isValidE164(phone: string): boolean {
  return E164_REGEX.test(phone);
}

/**
 * Extract country code from E.164 number
 */
export function getCountryFromPhone(phone: string): string | null {
  if (!isValidE164(phone)) return null;

  for (const [country, code] of Object.entries(COUNTRY_CODES)) {
    if (phone.startsWith(code)) {
      return country;
    }
  }
  return null;
}

/**
 * Format phone for display (with spaces)
 */
export function formatPhoneDisplay(phone: string): string {
  if (!isValidE164(phone)) return phone;

  // Côte d'Ivoire format: +225 XX XX XX XX XX
  if (phone.startsWith('+225') && phone.length === 14) {
    return `${phone.slice(0, 4)} ${phone.slice(4, 6)} ${phone.slice(6, 8)} ${phone.slice(8, 10)} ${phone.slice(10, 12)} ${phone.slice(12, 14)}`;
  }

  // Generic format: +XXX XXX XXX XXX
  return phone.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d+)/, '$1 $2 $3 $4');
}

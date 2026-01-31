import { parsePhoneNumber, isValidPhoneNumber, PhoneNumber } from 'libphonenumber-js';

/**
 * Normalize a phone number to E.164 format (+1234567890)
 * @param phoneNumber - The phone number to normalize
 * @param defaultCountry - Default country code (default: 'US')
 * @returns Normalized phone number in E.164 format, or null if invalid
 */
export function normalizePhoneNumber(
  phoneNumber: string,
  defaultCountry: 'US' | string = 'US'
): string | null {
  try {
    // Remove any whitespace
    const cleaned = phoneNumber.trim();

    // Try to parse the phone number
    const parsed = parsePhoneNumber(cleaned, defaultCountry as any);

    if (parsed && parsed.isValid()) {
      // Return in E.164 format (+1234567890)
      return parsed.format('E.164');
    }

    return null;
  } catch (error) {
    // If parsing fails, return null
    return null;
  }
}

/**
 * Validate if a phone number is valid
 * @param phoneNumber - The phone number to validate
 * @param defaultCountry - Default country code (default: 'US')
 * @returns true if valid, false otherwise
 */
export function validatePhoneNumber(
  phoneNumber: string,
  defaultCountry: 'US' | string = 'US'
): boolean {
  try {
    const cleaned = phoneNumber.trim();
    return isValidPhoneNumber(cleaned, defaultCountry as any);
  } catch (error) {
    return false;
  }
}

/**
 * Format a phone number for display
 * @param phoneNumber - The phone number to format
 * @param defaultCountry - Default country code (default: 'US')
 * @returns Formatted phone number (e.g., "+1 (234) 567-8900"), or original string if invalid
 */
export function formatPhoneNumber(
  phoneNumber: string,
  defaultCountry: 'US' | string = 'US'
): string {
  try {
    const cleaned = phoneNumber.trim();
    const parsed = parsePhoneNumber(cleaned, defaultCountry as any);

    if (parsed && parsed.isValid()) {
      // Format as international: +1 234 567 8900
      return parsed.formatInternational();
    }

    // If parsing fails, return original
    return phoneNumber;
  } catch (error) {
    return phoneNumber;
  }
}

/**
 * Check if two phone numbers match (accounting for different formats)
 * @param phoneNumber1 - First phone number
 * @param phoneNumber2 - Second phone number
 * @param defaultCountry - Default country code (default: 'US')
 * @returns true if the numbers match, false otherwise
 */
export function phoneNumbersMatch(
  phoneNumber1: string,
  phoneNumber2: string,
  defaultCountry: 'US' | string = 'US'
): boolean {
  const normalized1 = normalizePhoneNumber(phoneNumber1, defaultCountry);
  const normalized2 = normalizePhoneNumber(phoneNumber2, defaultCountry);

  // Both must be valid and match
  if (normalized1 && normalized2) {
    return normalized1 === normalized2;
  }

  return false;
}

/**
 * Extract just the digits from a phone number
 * @param phoneNumber - The phone number string
 * @returns String containing only digits
 */
export function extractDigits(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, '');
}

/**
 * Get country code from a phone number
 * @param phoneNumber - The phone number
 * @param defaultCountry - Default country code (default: 'US')
 * @returns Country code (e.g., '1' for US), or null if invalid
 */
export function getCountryCode(
  phoneNumber: string,
  defaultCountry: 'US' | string = 'US'
): string | null {
  try {
    const parsed = parsePhoneNumber(phoneNumber, defaultCountry as any);
    if (parsed && parsed.isValid()) {
      return parsed.countryCallingCode;
    }
    return null;
  } catch (error) {
    return null;
  }
}

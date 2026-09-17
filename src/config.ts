/**
 * Global Application Configuration
 * 
 * Single source of truth for the application base URL.
 * Currently set to the live Google AI Studio-hosted URL.
 * 
 * NOTE: If the app later moves to a custom domain (or production URL),
 * update APP_BASE_URL here. It is used for all public verification links,
 * QR codes, and referral sharing URLs.
 */
export const APP_BASE_URL = 'https://ais-dev-7t4kttwcg2h3j2w6q6ngo5-15810233840.europe-west2.run.app';

/**
 * Returns the full verification URL for a given theme-coded card ID.
 * Example: https://ais-dev-7t4kttwcg2h3j2w6q6ngo5-15810233840.europe-west2.run.app/verify/FK-BTS-DEF3
 */
export function getVerificationUrl(cardId: string): string {
  const cleanId = (cardId || '').trim();
  return `${APP_BASE_URL}/verify/${encodeURIComponent(cleanId)}`;
}

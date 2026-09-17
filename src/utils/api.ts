/**
 * Communication layer for the Google Apps Script Backend.
 */

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;

export async function backendApiCall(action: string, payload: any = {}) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('YOUR_ACTUAL_ID')) {
    return null;
  }

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action, ...payload }),
      headers: {
        'Content-Type': 'text/plain', // GAS requires text/plain to avoid CORS preflight issues
      },
    });

    const text = await response.text();
    try {
      const result = JSON.parse(text);
      if (!result.success) {
        return null;
      }
      return result.data;
    } catch (e) {
      // Not JSON, likely an HTML error page or GAS redirect limitation
      return null;
    }
  } catch (err) {
    // Network or CORS error
    return null;
  }
}

import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getAuth } from 'firebase/auth';
import { googleSheetsProvider, auth } from '../firebase';

let cachedAccessToken: string | null = null;

export async function authenticateGoogleSheets(): Promise<string | null> {
  try {
    const result = await signInWithPopup(auth, googleSheetsProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      return cachedAccessToken;
    }
    return null;
  } catch (error: any) {
    console.warn("Popup sign-in failed, trying redirect or reporting error:", error);
    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/popup-blocked-by-browser' || error?.code === 'auth/cancelled-popup-request') {
      try {
        await signInWithRedirect(auth, googleSheetsProvider);
        return null;
      } catch (redirectError) {
        console.error("Redirect sign-in error:", redirectError);
      }
    }
    throw error;
  }
}

export function getCachedAccessToken(): string | null {
  return cachedAccessToken;
}

export interface GoogleSpreadsheetItem {
  id: string;
  name: string;
  webViewLink?: string;
  createdTime?: string;
}

export async function listUserSpreadsheets(accessToken: string): Promise<GoogleSpreadsheetItem[]> {
  try {
    const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.spreadsheet'");
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink,createdTime)`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) throw new Error('Failed to fetch spreadsheets');
    const data = await res.json();
    return data.files || [];
  } catch (error) {
    console.error("Error listing spreadsheets:", error);
    return [];
  }
}

export async function createSpreadsheet(accessToken: string, title: string): Promise<GoogleSpreadsheetItem | null> {
  try {
    const res = await fetch('https://sheets.googleapis.com/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title,
        },
      }),
    });
    if (!res.ok) throw new Error('Failed to create spreadsheet');
    const data = await res.json();
    return {
      id: data.spreadsheetId,
      name: data.properties?.title || title,
      webViewLink: data.spreadsheetUrl,
    };
  } catch (error) {
    console.error("Error creating spreadsheet:", error);
    return null;
  }
}

export async function getSpreadsheetValues(accessToken: string, spreadsheetId: string, range = 'Sheet1!A1:Z100'): Promise<any[][]> {
  try {
    const res = await fetch(`https://sheets.googleapis.com/spreadsheets/${spreadsheetId}/values/${range}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) throw new Error('Failed to fetch spreadsheet values');
    const data = await res.json();
    return data.values || [];
  } catch (error) {
    console.error("Error getting spreadsheet values:", error);
    return [];
  }
}

export async function appendSpreadsheetValues(accessToken: string, spreadsheetId: string, range = 'Sheet1!A1', values: any[][]): Promise<boolean> {
  try {
    const res = await fetch(`https://sheets.googleapis.com/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values,
      }),
    });
    return res.ok;
  } catch (error) {
    console.error("Error appending spreadsheet values:", error);
    return false;
  }
}

export async function updateSpreadsheetValues(accessToken: string, spreadsheetId: string, range = 'Sheet1!A1', values: any[][]): Promise<boolean> {
  try {
    const res = await fetch(`https://sheets.googleapis.com/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values,
      }),
    });
    return res.ok;
  } catch (error) {
    console.error("Error updating spreadsheet values:", error);
    return false;
  }
}

export async function getOrCreateDatabaseSpreadsheet(accessToken: string): Promise<string | null> {
  try {
    const files = await listUserSpreadsheets(accessToken);
    const existing = files.find(f => f.name === 'FarukatCinema_Database');
    if (existing) return existing.id;

    // Create new DB spreadsheet with sheets
    const newSheet = await createSpreadsheet(accessToken, 'FarukatCinema_Database');
    if (!newSheet) return null;

    // Initialize sheets/headers
    await updateSpreadsheetValues(accessToken, newSheet.id, 'Sheet1!A1:B1', [['Key', 'Value']]);
    return newSheet.id;
  } catch (error) {
    console.error("Error getting or creating database spreadsheet:", error);
    return null;
  }
}


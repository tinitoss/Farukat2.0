import { getCachedAccessToken, getOrCreateDatabaseSpreadsheet, getSpreadsheetValues, updateSpreadsheetValues } from './googleSheets';
import { XpAccount } from '../types';

export async function loadAccountFromGoogleSheets(userId: string): Promise<XpAccount | null> {
  const token = getCachedAccessToken();
  if (!token) return null;
  try {
    const sheetId = await getOrCreateDatabaseSpreadsheet(token);
    if (!sheetId) return null;
    const values = await getSpreadsheetValues(token, sheetId, 'Sheet1!A1:B50');
    const row = values.find(r => r[0] === `account_${userId}`);
    if (row && row[1]) {
      return JSON.parse(row[1]) as XpAccount;
    }
  } catch (err) {
    console.error("Error loading account from Google Sheets:", err);
  }
  return null;
}

export async function saveAccountToGoogleSheets(userId: string, account: XpAccount): Promise<void> {
  const token = getCachedAccessToken();
  if (!token) return;
  try {
    const sheetId = await getOrCreateDatabaseSpreadsheet(token);
    if (!sheetId) return;
    const values = await getSpreadsheetValues(token, sheetId, 'Sheet1!A1:B50');
    const index = values.findIndex(r => r[0] === `account_${userId}`);
    const key = `account_${userId}`;
    const val = JSON.stringify(account);
    if (index >= 0) {
      values[index] = [key, val];
    } else {
      values.push([key, val]);
    }
    await updateSpreadsheetValues(token, sheetId, `Sheet1!A1:B${values.length}`, values);
  } catch (err) {
    console.error("Error saving account to Google Sheets:", err);
  }
}

export async function loadTableFromGoogleSheets<T>(tableName: string, userId: string, defaultVal: T): Promise<T> {
  const token = getCachedAccessToken();
  if (!token) return defaultVal;
  try {
    const sheetId = await getOrCreateDatabaseSpreadsheet(token);
    if (!sheetId) return defaultVal;
    const values = await getSpreadsheetValues(token, sheetId, 'Sheet1!A1:B50');
    const row = values.find(r => r[0] === `${tableName}_${userId}`);
    if (row && row[1]) {
      return JSON.parse(row[1]) as T;
    }
  } catch {
    // ignore
  }
  return defaultVal;
}

export async function saveTableToGoogleSheets<T>(tableName: string, userId: string, payload: T): Promise<void> {
  const token = getCachedAccessToken();
  if (!token) return;
  try {
    const sheetId = await getOrCreateDatabaseSpreadsheet(token);
    if (!sheetId) return;
    const values = await getSpreadsheetValues(token, sheetId, 'Sheet1!A1:B50');
    const key = `${tableName}_${userId}`;
    const val = JSON.stringify(payload);
    const index = values.findIndex(r => r[0] === key);
    if (index >= 0) {
      values[index] = [key, val];
    } else {
      values.push([key, val]);
    }
    await updateSpreadsheetValues(token, sheetId, `Sheet1!A1:B${values.length}`, values);
  } catch (err) {
    console.error(`Error saving ${tableName} to Google Sheets:`, err);
  }
}

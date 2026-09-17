import React, { useState, useEffect } from 'react';
import { 
  authenticateGoogleSheets, 
  getCachedAccessToken, 
  listUserSpreadsheets, 
  createSpreadsheet, 
  getSpreadsheetValues, 
  appendSpreadsheetValues,
  GoogleSpreadsheetItem 
} from '../utils/googleSheets';
import { FileSpreadsheet, Plus, ExternalLink, RefreshCw, Database, CheckCircle2, AlertCircle, ArrowLeft, Send, Crown, Download } from 'lucide-react';
import { getStoredWatchlist } from '../utils/mediaUtils';
import { MEDIA_CATALOG } from '../data/mediaData';
import { getXpAccount, checkIsPro } from '../utils/xpSystem';
import { useTranslation } from '../i18n/LanguageContext';

interface GoogleSheetsHubProps {
  onClose?: () => void;
}

export const GoogleSheetsHub: React.FC<GoogleSheetsHubProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [accessToken, setAccessToken] = useState<string | null>(getCachedAccessToken());
  const [loading, setLoading] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState<GoogleSpreadsheetItem[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<GoogleSpreadsheetItem | null>(null);
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [newSheetTitle, setNewSheetTitle] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [customRowData, setCustomRowData] = useState('');

  const handleConnect = async () => {
    setLoading(true);
    setStatusMessage('Authenticating with Google...');
    try {
      const token = await authenticateGoogleSheets();
      if (token) {
        setAccessToken(token);
        setStatusMessage('Connected successfully!');
        loadSheets(token);
      } else {
        setStatusMessage('Authentication redirect triggered or waiting for response.');
      }
    } catch (error: any) {
      console.error(error);
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/popup-blocked-by-browser') {
        setStatusMessage('Popup blocked or closed. Please click "Open in New Tab" at the top of AI Studio preview to connect Google Sheets.');
      } else {
        setStatusMessage(`Authentication error: ${error?.message || 'Unknown error'}`);
      }
    }
    setLoading(false);
  };

  const loadSheets = async (token: string) => {
    setLoading(true);
    setStatusMessage('Fetching spreadsheets from Google Drive...');
    const files = await listUserSpreadsheets(token);
    setSpreadsheets(files);
    setLoading(false);
    setStatusMessage(files.length > 0 ? `Found ${files.length} spreadsheet(s).` : 'No spreadsheets found.');
  };

  useEffect(() => {
    if (accessToken) {
      loadSheets(accessToken);
    }
  }, [accessToken]);

  const handleCreateSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !newSheetTitle.trim()) return;

    setLoading(true);
    setStatusMessage(`Creating spreadsheet "${newSheetTitle}"...`);
    const newSheet = await createSpreadsheet(accessToken, newSheetTitle.trim());
    if (newSheet) {
      setSpreadsheets([newSheet, ...spreadsheets]);
      setSelectedSheet(newSheet);
      setNewSheetTitle('');
      setStatusMessage('Spreadsheet created successfully!');
      // Initialize with headers
      await appendSpreadsheetValues(accessToken, newSheet.id, 'Sheet1!A1', [['Title', 'Category', 'Rating', 'Added Date']]);
      handleSelectSheet(newSheet);
    } else {
      setStatusMessage('Failed to create spreadsheet.');
    }
    setLoading(false);
  };

  const handleSelectSheet = async (sheet: GoogleSpreadsheetItem) => {
    if (!accessToken) return;
    setSelectedSheet(sheet);
    setLoading(true);
    setStatusMessage(`Loading data from "${sheet.name}"...`);
    const values = await getSpreadsheetValues(accessToken, sheet.id);
    setSheetData(values);
    setLoading(false);
    setStatusMessage(`Loaded ${values.length} row(s).`);
  };

  const handleExportProTradingLedger = async () => {
    const account = getXpAccount();
    const faraHistory = (account as any)?.faraTransactions || (account as any)?.faraHistory || [];

    if (faraHistory.length === 0) {
      setStatusMessage('No trading history found to export.');
      return;
    }

    setLoading(true);
    setStatusMessage('Exporting PRO Financial Trading Ledger...');

    const headers = [['Timestamp', 'Type', 'Title', 'FARA Amount', 'Protocol Fee Saved (PRO)', 'User ID']];
    const rows = faraHistory.map((h: any) => [
      new Date(h.timestamp || Date.now()).toLocaleString(),
      h.type || 'TRADE',
      h.title || 'Market Execution',
      `${h.amount >= 0 ? '+' : ''}${h.amount} FARA`,
      '0 FARA (0% PRO VIP Fee)',
      account.userId || 'User',
    ]);

    if (accessToken && selectedSheet) {
      await appendSpreadsheetValues(accessToken, selectedSheet.id, 'Sheet1!A1', [...headers, ...rows]);
      setStatusMessage('PRO Trading Ledger exported to Google Sheet!');
      handleSelectSheet(selectedSheet);
    } else {
      // Direct CSV Download Fallback
      const csvContent = 'data:text/csv;charset=utf-8,' + [...headers, ...rows].map((e) => e.join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `FARUKAT_PRO_Trading_Ledger_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setStatusMessage('PRO Trading Ledger exported as CSV file!');
    }
    setLoading(false);
  };

  const handleExportWatchlist = async () => {
    if (!accessToken || !selectedSheet) return;
    const watchlistIds = getStoredWatchlist();
    const watchlistItems = MEDIA_CATALOG.filter(m => watchlistIds.includes(m.id));

    if (watchlistItems.length === 0) {
      setStatusMessage('Your watchlist is empty to export.');
      return;
    }

    setLoading(true);
    setStatusMessage('Exporting watchlist to Google Sheet...');
    
    const rows = watchlistItems.map(item => [
      item.title,
      item.category,
      item.rating || 'N/A',
      new Date().toISOString().split('T')[0]
    ]);

    const success = await appendSpreadsheetValues(accessToken, selectedSheet.id, 'Sheet1!A1', rows);
    if (success) {
      setStatusMessage('Watchlist exported successfully!');
      handleSelectSheet(selectedSheet);
    } else {
      setStatusMessage('Failed to export watchlist.');
    }
    setLoading(false);
  };

  const handleAddCustomRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !selectedSheet || !customRowData.trim()) return;

    setLoading(true);
    const cols = customRowData.split(',').map(s => s.trim());
    const success = await appendSpreadsheetValues(accessToken, selectedSheet.id, 'Sheet1!A1', [cols]);
    if (success) {
      setCustomRowData('');
      setStatusMessage('Row added successfully!');
      handleSelectSheet(selectedSheet);
    } else {
      setStatusMessage('Failed to add row.');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-[var(--text-primary)]">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-emerald-500/20 rounded-xl border border-emerald-500/30 text-emerald-400">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Google Sheets Integration</h1>
            <p className="text-sm text-gray-400">Manage, create, and sync your app data directly with Google Sheets and Drive.</p>
          </div>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-colors"
          >
            Close
          </button>
        )}
      </div>

      {!accessToken ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center max-w-xl mx-auto backdrop-blur-xl">
          <Database className="w-16 h-16 text-emerald-400 mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-semibold mb-2">Connect Your Google Account</h2>
          <p className="text-gray-400 mb-6 text-sm">
            Authenticate with Google to securely browse your spreadsheets, create new trackers, and export your watchlists instantly.
          </p>
          <button
            onClick={handleConnect}
            disabled={loading}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-[var(--text-primary)] rounded-xl font-medium shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 mx-auto"
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span>{loading ? 'Connecting...' : 'Connect Google Sheets'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar: Spreadsheets list & Creator */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <span>Your Spreadsheets</span>
              </h2>
              <button 
                onClick={() => loadSheets(accessToken)}
                disabled={loading}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs flex items-center space-x-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <form onSubmit={handleCreateSheet} className="space-y-3">
              <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Create New Spreadsheet</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Spreadsheet title..."
                  value={newSheetTitle}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  className="flex-1 bg-[var(--bg-main)]/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={loading || !newSheetTitle.trim()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl text-sm font-medium transition-colors flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </form>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {spreadsheets.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No spreadsheets found in your Google Drive.</p>
              ) : (
                spreadsheets.map(sheet => (
                  <button
                    key={sheet.id}
                    onClick={() => handleSelectSheet(sheet)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                      selectedSheet?.id === sheet.id 
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' 
                        : 'bg-[var(--bg-main)]/20 border-white/5 hover:bg-white/10 text-gray-300'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <p className="text-sm font-medium truncate">{sheet.name}</p>
                      <p className="text-xs text-gray-500">ID: {sheet.id.slice(0, 10)}...</p>
                    </div>
                    {sheet.webViewLink && (
                      <a
                        href={sheet.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-gray-400 hover:text-[var(--text-primary)] p-1"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Main content: Selected Spreadsheet viewer & editor */}
          <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl flex flex-col justify-between">
            {selectedSheet ? (
              <div className="space-y-6 flex-1 flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                  <div>
                    <h2 className="text-xl font-bold">{selectedSheet.name}</h2>
                    <p className="text-xs text-gray-400">Spreadsheet ID: {selectedSheet.id}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleExportProTradingLedger}
                      disabled={loading}
                      className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 rounded-xl text-xs font-bold text-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                      title="1-Click export user market trades & 0% fee savings log"
                    >
                      <Crown className="w-3.5 h-3.5 fill-current text-amber-400" />
                      <span>Export PRO Trading Ledger</span>
                    </button>
                    <button
                      onClick={handleExportWatchlist}
                      disabled={loading}
                      className="px-4 py-2 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 rounded-xl text-xs font-medium text-emerald-300 transition-colors flex items-center space-x-1.5"
                    >
                      <span>Export Watchlist</span>
                    </button>
                    {selectedSheet.webViewLink && (
                      <a
                        href={selectedSheet.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-medium transition-colors flex items-center space-x-1.5"
                      >
                        <span>Open in Google Sheets</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Add row form */}
                <form onSubmit={handleAddCustomRow} className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Add row data separated by comma (e.g. Inception, Sci-Fi, 9.5)"
                    value={customRowData}
                    onChange={(e) => setCustomRowData(e.target.value)}
                    className="flex-1 bg-[var(--bg-main)]/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={loading || !customRowData.trim()}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-xl text-sm font-medium transition-colors flex items-center space-x-1"
                  >
                    <Send className="w-4 h-4" />
                    <span>Add Row</span>
                  </button>
                </form>

                {/* Data table view */}
                <div className="flex-1 overflow-x-auto rounded-xl border border-white/10 bg-[var(--bg-main)]/30 max-h-96">
                  {sheetData.length === 0 ? (
                    <div className="text-center py-16 text-gray-500 text-sm">
                      This spreadsheet is currently empty.
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <tbody>
                        {sheetData.map((row, rIdx) => (
                          <tr key={rIdx} className={rIdx === 0 ? 'bg-white/10 font-semibold border-b border-white/10' : 'border-b border-white/5 hover:bg-white/5'}>
                            {row.map((cell: any, cIdx: number) => (
                              <td key={cIdx} className="px-4 py-3 whitespace-nowrap text-gray-300">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-center py-20 text-gray-500">
                <FileSpreadsheet className="w-16 h-16 mb-3 text-gray-600" />
                <p className="text-base font-medium text-gray-400">Select or create a spreadsheet from the sidebar</p>
                <p className="text-xs text-gray-500 mt-1">View rows, export your watchlist, or append new data in real time.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {statusMessage && (
        <div className="mt-6 p-4 bg-[var(--bg-main)]/40 border border-white/10 rounded-xl text-center text-sm text-gray-300">
          {statusMessage}
        </div>
      )}
    </div>
  );
};

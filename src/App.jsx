import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutGrid, Receipt, Landmark, Settings as SettingsIcon, 
  Upload, Cloud, Moon, Sun, AlertTriangle, ShieldCheck, CheckCircle2, Tag,
  TrendingUp
} from 'lucide-react';

import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import AccountManager from './components/AccountManager';
import DuplicateWizard from './components/DuplicateWizard';
import Settings from './components/Settings';
import CategoryManager from './components/CategoryManager';
import NetWorth from './components/NetWorth';

import { parseBankStatement } from './utils/csvParser';
import { detectDuplicates } from './utils/duplicateDetector';
import { initOAuthClient, syncAndLoadDatabase, saveDatabaseToDrive } from './utils/googleDriveHelper';
import { getAutoCategoryId } from './utils/autoCategorizer';

const LOCAL_STORAGE_DB_KEY = 'finite_local_db';
const LOCAL_STORAGE_CLIENT_ID_KEY = 'finite_google_client_id';

const DEFAULT_DB = {
  accounts: [],
  categories: [
    { id: 'cat-uncategorized', name: 'Uncategorized' },
    { id: 'cat-groceries', name: 'Groceries' },
    { id: 'cat-housing', name: 'Housing/Mortgage/Rent' },
    { id: 'cat-utilities', name: 'Utilities' },
    { id: 'cat-salary', name: 'Salary/Income' },
    { id: 'cat-entertainment', name: 'Entertainment/Dining' },
    { id: 'cat-transportation', name: 'Transportation/Auto' },
    { id: 'cat-transfer', name: 'Internal Transfer' }
  ],
  transactions: []
};

export default function App() {
  // App settings & theme
  const [theme, setTheme] = useState(() => localStorage.getItem('finite-theme') || 'dark');
  const [clientId, setClientId] = useState(() => localStorage.getItem(LOCAL_STORAGE_CLIENT_ID_KEY) || '');
  
  // Google Drive states
  const [accessToken, setAccessToken] = useState('');
  const [dbFileId, setDbFileId] = useState('');
  const [syncState, setSyncState] = useState('Local Mode'); // 'Local Mode', 'Syncing...', 'Saved', 'Error'
  const [syncError, setSyncError] = useState('');

  // Main Database State
  const [database, setDatabase] = useState(() => {
    const cached = localStorage.getItem(LOCAL_STORAGE_DB_KEY);
    return cached ? JSON.parse(cached) : DEFAULT_DB;
  });

  // Navigation: 'dashboard' | 'transactions' | 'accounts' | 'settings' | 'import-upload' | 'duplicate-wizard'
  const [currentView, setCurrentView] = useState('dashboard');

  // CSV Import States
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [pendingImports, setPendingImports] = useState([]);
  const [importError, setImportError] = useState('');

  // Save changes ref to track changes and debounce uploads
  const saveTimeoutRef = useRef(null);
  const isFirstMount = useRef(true);

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('finite-theme', theme);
  }, [theme]);

  // Handle saving Client ID
  useEffect(() => {
    if (clientId) {
      localStorage.setItem(LOCAL_STORAGE_CLIENT_ID_KEY, clientId);
      // Initialize GIS client
      initOAuthClient(
        clientId,
        (token) => {
          setAccessToken(token);
          setSyncState('Syncing...');
          setSyncError('');
        },
        (err) => {
          setSyncError(err);
          setSyncState('Error');
        }
      );
    } else {
      localStorage.removeItem(LOCAL_STORAGE_CLIENT_ID_KEY);
    }
  }, [clientId]);

  // Load database from Google Drive when accessToken is available
  useEffect(() => {
    if (!accessToken) return;

    async function loadCloudDb() {
      try {
        setSyncState('Syncing...');
        const { fileId, data } = await syncAndLoadDatabase(accessToken);
        setDbFileId(fileId);
        
        // Merge cloud data with local data, prioritizing cloud data
        setDatabase(data);
        localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(data));
        setSyncState('Saved');
      } catch (err) {
        setSyncError('Load error: ' + err.message);
        setSyncState('Error');
      }
    }
    loadCloudDb();
  }, [accessToken]);

  // Debounced auto-save to LocalStorage and Google Drive
  useEffect(() => {
    // Skip saving on first mount to avoid overwrite before fetch
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    // Always cache locally instantly
    localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(database));

    // If connected to Google Drive, save to cloud
    if (accessToken && dbFileId) {
      setSyncState('Saving...');
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await saveDatabaseToDrive(dbFileId, database, accessToken);
          setSyncState('Saved');
          setSyncError('');
        } catch (err) {
          setSyncError('Sync error: ' + err.message);
          setSyncState('Error');
        }
      }, 2000); // 2 second debounce
    }

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [database, accessToken, dbFileId]);

  // Explicit sync trigger
  const handleForceSync = async () => {
    if (!accessToken || !dbFileId) return;
    try {
      setSyncState('Saving...');
      await saveDatabaseToDrive(dbFileId, database, accessToken);
      setSyncState('Saved');
      setSyncError('');
      alert('Database synced to Google Drive successfully!');
    } catch (err) {
      setSyncError('Sync error: ' + err.message);
      setSyncState('Error');
      alert('Sync failed: ' + err.message);
    }
  };

  // Auth logout
  const handleLogout = () => {
    setAccessToken('');
    setDbFileId('');
    setSyncState('Local Mode');
    setSyncError('');
  };

  // CSV Drag and Drop parsing
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!selectedAccountId) {
      setImportError('Please select a bank account first.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const { transactions: parsed, error, bank } = parseBankStatement(text);

      if (error) {
        setImportError(error);
        return;
      }

      if (parsed.length === 0) {
        setImportError('No transaction rows found in CSV.');
        return;
      }

      // Check duplicates
      const { transactions: annotated, hasDuplicates } = detectDuplicates(
        parsed,
        database.transactions,
        selectedAccountId
      );

      setPendingImports(annotated);
      setImportError('');
      setCurrentView('duplicate-wizard');
    };
    reader.onerror = () => {
      setImportError('Failed to read file.');
    };
    reader.readAsText(file);
  };

  // Complete CSV import process
  const handleCompleteImport = (newTxs, overwriteMap) => {
    // 1. Process updates to existing transactions (overwrites)
    let updatedTransactions = database.transactions.map(ext => {
      if (overwriteMap[ext.id]) {
        return overwriteMap[ext.id];
      }
      return ext;
    });

    // 2. Add brand new transactions
    updatedTransactions = [...newTxs, ...updatedTransactions];

    // Sort transactions by date descending
    updatedTransactions.sort((a, b) => b.date.localeCompare(a.date));

    // 3. Save database
    setDatabase(prev => ({
      ...prev,
      transactions: updatedTransactions
    }));

    setPendingImports([]);
    setCurrentView('transactions');
    alert(`Successfully imported transactions!`);
  };

  // View renderer
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard 
            transactions={database.transactions}
            accounts={database.accounts}
            categories={database.categories}
          />
        );
      case 'net-worth':
        return (
          <NetWorth 
            transactions={database.transactions}
            accounts={database.accounts}
          />
        );
      case 'transactions':
        return (
          <TransactionList 
            transactions={database.transactions}
            accounts={database.accounts}
            categories={database.categories}
            onAddCategory={(newCat) => {
              setDatabase(prev => ({
                ...prev,
                categories: [...prev.categories, { ...newCat, keywords: [] }]
              }));
            }}
            onUpdateTransaction={(updated) => {
              setDatabase(prev => ({
                ...prev,
                transactions: prev.transactions.map(t => t.id === updated.id ? updated : t)
              }));
            }}
            onDeleteTransaction={(id) => {
              setDatabase(prev => ({
                ...prev,
                transactions: prev.transactions.filter(t => t.id !== id)
              }));
            }}
          />
        );
      case 'accounts':
        return (
          <AccountManager 
            accounts={database.accounts}
            onSaveAccounts={(updatedAccounts) => {
              setDatabase(prev => ({
                ...prev,
                accounts: updatedAccounts
              }));
            }}
          />
        );
      case 'categories':
        return (
          <CategoryManager 
            categories={database.categories}
            transactions={database.transactions}
            onAddCategory={(newCat) => {
              setDatabase(prev => ({
                ...prev,
                categories: [...prev.categories, { ...newCat, keywords: [] }]
              }));
            }}
            onDeleteCategory={(catId) => {
              setDatabase(prev => ({
                ...prev,
                categories: prev.categories.filter(c => c.id !== catId)
              }));
            }}
            onUpdateCategory={(updated) => {
              setDatabase(prev => ({
                ...prev,
                categories: prev.categories.map(c => c.id === updated.id ? updated : c)
              }));
            }}
            onApplyAutoCategorize={() => {
              let updatedCount = 0;
              const updatedTransactions = database.transactions.map(tx => {
                if (tx.reviewed) return tx;
                
                let txUpdated = false;
                const updatedSplits = tx.splits.map(split => {
                  if (split.categoryId === 'cat-uncategorized') {
                    const autoId = getAutoCategoryId(tx.description, database.categories);
                    if (autoId !== 'cat-uncategorized') {
                      txUpdated = true;
                      return { 
                        ...split, 
                        categoryId: autoId, 
                        notes: split.notes ? `${split.notes} (Auto)` : 'Auto-categorized'
                      };
                    }
                  }
                  return split;
                });
                
                if (txUpdated) {
                  updatedCount++;
                  return { ...tx, splits: updatedSplits };
                }
                return tx;
              });

              if (updatedCount > 0) {
                setDatabase(prev => ({
                  ...prev,
                  transactions: updatedTransactions
                }));
              }
              return updatedCount;
            }}
          />
        );
      case 'settings':
        return (
          <Settings 
            clientId={clientId}
            setClientId={setClientId}
            accessToken={accessToken}
            onLogout={handleLogout}
            syncState={syncState}
            syncError={syncError}
            onForceSync={handleForceSync}
          />
        );
      case 'import-upload':
        return (
          <div className="card fade-in" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
            <h2 className="card-title">
              <Upload size={20} className="text-primary" />
              Import Statement CSV
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Select an account and upload the bank statement CSV. We support Chase, Prosperity, and Citi formats.
            </p>

            <div className="form-group">
              <label htmlFor="importAccount">Target Bank Account</label>
              <select 
                id="importAccount"
                className="input select"
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  setImportError('');
                }}
              >
                <option value="">-- Select Bank Account --</option>
                {database.accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.bank})</option>
                ))}
              </select>
            </div>

            {selectedAccountId ? (
              <div style={{ marginTop: '1.5rem' }}>
                <label>Drag or Select Statement CSV</label>
                <label className="upload-dropzone" htmlFor="csvFilePicker" style={{ marginTop: '6px' }}>
                  <Upload size={32} className="text-primary" />
                  <span style={{ fontWeight: '600' }}>Choose CSV File</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click to browse or drop statement file here</span>
                  <input 
                    id="csvFilePicker"
                    type="file" 
                    accept=".csv,.CSV" 
                    onChange={handleCSVUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            ) : (
              <div style={{ padding: '1rem', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.85rem' }}>
                Please select a target account above to enable CSV uploading.
              </div>
            )}

            {importError && (
              <div style={{ display: 'flex', gap: '8px', padding: '10px', backgroundColor: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--danger)', marginTop: '1.25rem' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>Error: {importError}</span>
              </div>
            )}
          </div>
        );
      case 'duplicate-wizard':
        const targetAcc = database.accounts.find(a => a.id === selectedAccountId);
        return (
          <DuplicateWizard 
            pendingTransactions={pendingImports}
            account={targetAcc}
            categories={database.categories}
            onCompleteImport={handleCompleteImport}
            onCancel={() => {
              setPendingImports([]);
              setCurrentView('import-upload');
            }}
          />
        );
      default:
        return <div>View not found.</div>;
    }
  };

  return (
    <div className="app-container">
      
      {/* Side Navigation panel */}
      <aside className="app-sidebar">
        <div>
          <div className="brand-section">
            <div className="brand-logo">Fi</div>
            <h1 className="brand-name">FiNite</h1>
          </div>

          <nav>
            <ul className="nav-links">
              <li>
                <div 
                  className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setCurrentView('dashboard')}
                >
                  <LayoutGrid size={18} />
                  <span>Dashboard</span>
                </div>
              </li>
              <li>
                <div 
                  className={`nav-item ${currentView === 'net-worth' ? 'active' : ''}`}
                  onClick={() => setCurrentView('net-worth')}
                >
                  <TrendingUp size={18} />
                  <span>Net Worth</span>
                </div>
              </li>
              <li>
                <div 
                  className={`nav-item ${currentView === 'transactions' ? 'active' : ''}`}
                  onClick={() => setCurrentView('transactions')}
                >
                  <Receipt size={18} />
                  <span>Transactions Log</span>
                </div>
              </li>
              <li>
                <div 
                  className={`nav-item ${currentView === 'accounts' ? 'active' : ''}`}
                  onClick={() => setCurrentView('accounts')}
                >
                  <Landmark size={18} />
                  <span>Bank Accounts</span>
                </div>
              </li>
              <li>
                <div 
                  className={`nav-item ${currentView === 'categories' ? 'active' : ''}`}
                  onClick={() => setCurrentView('categories')}
                >
                  <Tag size={18} />
                  <span>Categories</span>
                </div>
              </li>
              <li>
                <div 
                  className={`nav-item ${currentView === 'import-upload' || currentView === 'duplicate-wizard' ? 'active' : ''}`}
                  onClick={() => setCurrentView('import-upload')}
                >
                  <Upload size={18} />
                  <span>Import Statement</span>
                </div>
              </li>
              <li>
                <div 
                  className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
                  onClick={() => setCurrentView('settings')}
                >
                  <SettingsIcon size={18} />
                  <span>Settings</span>
                </div>
              </li>
            </ul>
          </nav>
        </div>

        <div className="sidebar-footer">
          {/* Sync status pills */}
          <div className="sync-status">
            <div className={`status-dot ${syncState === 'Syncing...' || syncState === 'Saving...' ? 'syncing' : syncState === 'Error' ? 'error' : ''}`} />
            <span>{syncState}</span>
            {syncState === 'Saved' && <CheckCircle2 size={12} className="text-success" />}
          </div>

          {/* Theme switcher */}
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
          >
            {theme === 'dark' ? (
              <>
                <Sun size={14} />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon size={14} />
                <span>Dark Mode</span>
              </>
            )}
          </button>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            FiNite Ledger v1.0.0
          </div>
        </div>
      </aside>

      {/* Main Panel views */}
      <main className="main-content">
        <header className="header-bar">
          <h2 style={{ fontSize: '1.25rem' }}>
            {currentView === 'dashboard' && 'Dashboard Overview'}
            {currentView === 'net-worth' && 'Net Worth History'}
            {currentView === 'transactions' && 'Transactions'}
            {currentView === 'accounts' && 'Configure Bank Accounts'}
            {currentView === 'categories' && 'Manage Categories'}
            {currentView === 'import-upload' && 'Import CSV Statement'}
            {currentView === 'duplicate-wizard' && 'Duplicate Resolution'}
            {currentView === 'settings' && 'Integration Settings'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {accessToken && (
              <span className="badge badge-new" style={{ textTransform: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cloud size={14} />
                Cloud Synced
              </span>
            )}
          </div>
        </header>

        <div className="view-container">
          {renderView()}
        </div>
      </main>

    </div>
  );
}

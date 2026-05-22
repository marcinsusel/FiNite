import React, { useState } from 'react';
import { Key, LogOut, CheckCircle, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { loginToGoogle } from '../utils/googleDriveHelper';

export default function Settings({ 
  clientId, 
  setClientId, 
  accessToken, 
  onLogout, 
  syncError, 
  syncState,
  onForceSync 
}) {
  const [tempId, setTempId] = useState(clientId || '');
  const [copiedId, setCopiedId] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setClientId(tempId.trim());
    alert('Google Client ID saved! You can now log in.');
  };

  return (
    <div className="card fade-in" style={{ maxWidth: '640px', margin: '0 auto', width: '100%' }}>
      <h2 className="card-title" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>
        <ShieldCheck className="text-primary" size={24} />
        Google Integration Settings
      </h2>

      <form onSubmit={handleSave} style={{ marginBottom: '2rem' }}>
        <div className="form-group">
          <label htmlFor="clientId">Google OAuth Client ID</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              id="clientId"
              type="text" 
              className="input" 
              placeholder="123456789-abc.apps.googleusercontent.com"
              value={tempId}
              onChange={(e) => setTempId(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Enter your Google Cloud Console OAuth 2.0 Web Client ID to enable cloud backups.
          </p>
        </div>
      </form>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Connection Status</h3>
        
        {accessToken ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)' }}>
              <CheckCircle size={18} />
              <span>Successfully authenticated with Google.</span>
            </div>
            
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              <p>Sync Status: <strong>{syncState}</strong></p>
              {syncError && (
                <div style={{ color: 'var(--danger)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} />
                  <span>Error: {syncError}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={onForceSync} className="btn btn-secondary btn-sm" title="Force save to Google Drive">
                <RefreshCw size={14} />
                Sync Now
              </button>
              <button onClick={onLogout} className="btn btn-danger btn-sm">
                <LogOut size={14} />
                Disconnect Account
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)' }}>
              <AlertTriangle size={18} />
              <span>Not logged in to Google Drive.</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Data will be cached locally in your browser. Log in to synchronize your bank transaction database with your personal Google Drive folder.
            </p>
            {clientId ? (
              <button onClick={loginToGoogle} className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: '8px' }}>
                <Key size={16} />
                Authorize Google Access
              </button>
            ) : (
              <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: '4px', fontSize: '0.85rem', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                Please enter and save a Client ID above to authorize access.
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '2rem', paddingTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <h4 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>How to get a Client ID?</h4>
        <ol style={{ paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Google Cloud Console</a> and create a project.</li>
          <li>Go to **APIs & Services** &gt; **Library**, search for **Google Drive API** and enable it.</li>
          <li>Go to **APIs & Services** &gt; **Credentials**, click **Create Credentials** &gt; **OAuth client ID**.</li>
          <li>Set application type to **Web application**.</li>
          <li>Add `http://localhost:5173` (or your active web server URL) under **Authorized JavaScript origins** and **Authorized redirect URIs**.</li>
          <li>Copy the generated Client ID and paste it above!</li>
        </ol>
      </div>
    </div>
  );
}

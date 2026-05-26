import React, { useState } from 'react';
import { Landmark, Plus, Trash2, CreditCard, PiggyBank, Receipt, Briefcase, Calendar, X } from 'lucide-react';

export default function AccountManager({ accounts, onSaveAccounts }) {
  const [name, setName] = useState('');
  const [bank, setBank] = useState('Chase');
  const [type, setType] = useState('checking');

  // Manual Balances state
  const [activeAcc, setActiveAcc] = useState(null);
  const [newBalanceDate, setNewBalanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newBalanceValue, setNewBalanceValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newAccount = {
      id: `acc_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      bank: type === 'summary' ? 'Manual' : bank,
      type,
      balances: type === 'summary' ? [] : undefined
    };

    onSaveAccounts([...accounts, newAccount]);
    setName('');
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this account? All transaction associations and balance history for this account will be lost.')) {
      onSaveAccounts(accounts.filter(acc => acc.id !== id));
      if (activeAcc && activeAcc.id === id) {
        setActiveAcc(null);
      }
    }
  };

  const handleOpenBalancesDrawer = (acc) => {
    setActiveAcc(acc);
    setNewBalanceDate(new Date().toISOString().split('T')[0]);
    setNewBalanceValue('');
  };

  const handleAddBalanceEntry = () => {
    if (!newBalanceDate || newBalanceValue === '') return;
    const value = parseFloat(newBalanceValue);
    if (isNaN(value)) return;

    const currentBalances = activeAcc.balances || [];
    const existingIdx = currentBalances.findIndex(b => b.date === newBalanceDate);
    let updatedBalances = [...currentBalances];

    if (existingIdx >= 0) {
      updatedBalances[existingIdx] = { ...updatedBalances[existingIdx], balance: value };
    } else {
      updatedBalances.push({
        id: `bal_${Math.random().toString(36).substr(2, 9)}`,
        date: newBalanceDate,
        balance: value
      });
    }

    // Sort balances descending by date
    updatedBalances.sort((a, b) => b.date.localeCompare(a.date));

    const updatedAccount = {
      ...activeAcc,
      balances: updatedBalances
    };

    onSaveAccounts(accounts.map(acc => acc.id === activeAcc.id ? updatedAccount : acc));
    setActiveAcc(updatedAccount);
    setNewBalanceValue('');
  };

  const handleDeleteBalanceEntry = (balId) => {
    const updatedBalances = (activeAcc.balances || []).filter(b => b.id !== balId);
    const updatedAccount = {
      ...activeAcc,
      balances: updatedBalances
    };
    onSaveAccounts(accounts.map(acc => acc.id === activeAcc.id ? updatedAccount : acc));
    setActiveAcc(updatedAccount);
  };

  const getAccountIcon = (type) => {
    switch (type) {
      case 'credit': return <CreditCard size={18} className="text-primary" />;
      case 'savings': return <PiggyBank size={18} className="text-primary" />;
      case 'summary': return <Briefcase size={18} className="text-primary" />;
      default: return <Receipt size={18} className="text-primary" />;
    }
  };

  const checking = accounts.filter(acc => acc.type === 'checking');
  const savings = accounts.filter(acc => acc.type === 'savings');
  const credit = accounts.filter(acc => acc.type === 'credit');
  const summary = accounts.filter(acc => acc.type === 'summary');

  const renderAccountGroup = (title, groupAccounts) => {
    if (groupAccounts.length === 0) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.25rem' }}>
        <h3 style={{ 
          fontSize: '0.75rem', 
          textTransform: 'uppercase', 
          letterSpacing: '0.05em', 
          color: 'var(--primary)', 
          fontWeight: '700', 
          borderBottom: '1px solid var(--border-color)', 
          paddingBottom: '4px', 
          marginBottom: '6px',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <span>{title}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({groupAccounts.length})</span>
        </h3>
        {groupAccounts.map(acc => (
          <div 
            key={acc.id} 
            className="compare-card" 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', marginBottom: '4px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.08)' }}>
                {getAccountIcon(acc.type)}
              </div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{acc.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {acc.type === 'summary' ? 'MANUAL' : `Format: ${acc.bank}`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {acc.type === 'summary' && (
                <button 
                  onClick={() => handleOpenBalancesDrawer(acc)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '4px 8px', fontSize: '0.75rem', minHeight: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
                  title="Manage manual balance history"
                >
                  <Calendar size={12} />
                  Balances
                </button>
              )}
              <button 
                onClick={() => handleDelete(acc.id)} 
                className="btn btn-secondary btn-sm" 
                style={{ color: 'var(--danger)', padding: '6px', minHeight: 'auto' }}
                title="Delete Account"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="grid-cols-2 fade-in">
        {/* Account Creation Form */}
        <div className="card" style={{ height: 'fit-content' }}>
          <h2 className="card-title">
            <Plus size={20} className="text-primary" />
            Add Account
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="accName">Account Name</label>
              <input 
                id="accName"
                type="text" 
                className="input" 
                placeholder="e.g. Wealthfront Manual Portfolio" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {type !== 'summary' && (
              <div className="form-group fade-in">
                <label htmlFor="accBank">Bank CSV Mapping Format</label>
                <select 
                  id="accBank"
                  className="input select"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                >
                  <option value="Chase">Chase Bank</option>
                  <option value="Prosperity">Prosperity Bank</option>
                  <option value="Citi">Citi Card</option>
                  <option value="Generic">Generic CSV (Guesses mapping)</option>
                </select>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Assigns the default parser mapping when importing statements for this account.
                </p>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="accType">Account Type</label>
              <select 
                id="accType"
                className="input select"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  if (e.target.value === 'summary') {
                    setBank('Generic');
                  }
                }}
              >
                <option value="checking">Checking Account</option>
                <option value="savings">Savings Account</option>
                <option value="credit">Credit Card</option>
                <option value="summary">Summary Account (Manual)</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%' }}>
              <Landmark size={16} />
              Create Account
            </button>
          </form>
        </div>

        {/* Account List */}
        <div className="card">
          <h2 className="card-title">
            <Landmark size={20} className="text-primary" />
            Your Accounts ({accounts.length})
          </h2>

          {accounts.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Landmark size={32} style={{ opacity: 0.3 }} />
              <span>No accounts configured yet. Create one on the left to start tracking.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '480px', overflowY: 'auto', paddingRight: '4px' }}>
              {renderAccountGroup('Checking Accounts', checking)}
              {renderAccountGroup('Savings Accounts', savings)}
              {renderAccountGroup('Credit Cards', credit)}
              {renderAccountGroup('Summary Accounts (Manual)', summary)}
            </div>
          )}
        </div>
      </div>

      {/* Drawer Overlay for Manual Balances */}
      {activeAcc && (
        <div className="split-drawer-overlay" onClick={() => setActiveAcc(null)}>
          <div className="split-drawer" onClick={(e) => e.stopPropagation()}>
            
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem' }}>Balance History</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{activeAcc.name}</span>
              </div>
              <button onClick={() => setActiveAcc(null)} className="btn btn-secondary btn-sm" style={{ padding: '6px', minHeight: 'auto' }}>
                <X size={16} />
              </button>
            </div>

            {/* Add New Balance Form */}
            <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', fontWeight: '600' }}>Add/Update Balance</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Date</label>
                    <input 
                      type="date" 
                      className="input" 
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      value={newBalanceDate}
                      onChange={(e) => setNewBalanceDate(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Balance ($)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="input" 
                      placeholder="e.g. 12500.00"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      value={newBalanceValue}
                      onChange={(e) => setNewBalanceValue(e.target.value)}
                    />
                  </div>
                </div>
                <button 
                  onClick={handleAddBalanceEntry} 
                  className="btn btn-primary btn-sm"
                  style={{ alignSelf: 'flex-end', marginTop: '4px' }}
                >
                  <Plus size={14} />
                  Add Balance Entry
                </button>
              </div>
            </div>

            {/* Historical Entries List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexGrow: 1, overflowY: 'auto' }}>
              <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Historical Records</h4>
              
              {(activeAcc.balances || []).length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  No balance records yet. Add an entry above.
                </div>
              ) : (
                <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th style={{ textAlign: 'right' }}>Balance</th>
                        <th style={{ width: '50px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeAcc.balances || []).map(entry => (
                        <tr key={entry.id}>
                          <td style={{ fontWeight: '500' }}>{entry.date}</td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }} className={entry.balance >= 0 ? 'amt-inflow' : 'amt-outflow'}>
                            {entry.balance < 0 ? '-' : ''}${Math.abs(entry.balance).toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              onClick={() => handleDeleteBalanceEntry(entry.id)} 
                              className="btn btn-secondary btn-sm" 
                              style={{ color: 'var(--danger)', padding: '4px', minHeight: 'auto' }}
                              title="Delete entry"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}

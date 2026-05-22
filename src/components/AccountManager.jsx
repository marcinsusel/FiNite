import React, { useState } from 'react';
import { Landmark, Plus, Trash2, CreditCard, PiggyBank, Receipt } from 'lucide-react';

export default function AccountManager({ accounts, onSaveAccounts }) {
  const [name, setName] = useState('');
  const [bank, setBank] = useState('Chase');
  const [type, setType] = useState('checking');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newAccount = {
      id: `acc_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      bank,
      type
    };

    onSaveAccounts([...accounts, newAccount]);
    setName('');
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this bank account? All transactions associated with this account will remain, but the account association will be lost.')) {
      onSaveAccounts(accounts.filter(acc => acc.id !== id));
    }
  };

  const getAccountIcon = (type) => {
    switch (type) {
      case 'credit': return <CreditCard size={18} className="text-primary" />;
      case 'savings': return <PiggyBank size={18} className="text-primary" />;
      default: return <Receipt size={18} className="text-primary" />;
    }
  };

  return (
    <div className="grid-cols-2 fade-in">
      {/* Account Creation Form */}
      <div className="card">
        <h2 className="card-title">
          <Plus size={20} className="text-primary" />
          Add Bank Account
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="accName">Account Name</label>
            <input 
              id="accName"
              type="text" 
              className="input" 
              placeholder="e.g. Chase checking ...5450" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
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

          <div className="form-group">
            <label htmlFor="accType">Account Type</label>
            <select 
              id="accType"
              className="input select"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="checking">Checking Account</option>
              <option value="savings">Savings Account</option>
              <option value="credit">Credit Card</option>
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
            <span>No bank accounts configured yet. Create one on the left to start importing transactions.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
            {accounts.map(acc => (
              <div 
                key={acc.id} 
                className="compare-card" 
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.08)' }}>
                    {getAccountIcon(acc.type)}
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{acc.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Format: {acc.bank} &bull; {acc.type.toUpperCase()}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(acc.id)} 
                  className="btn btn-secondary btn-sm" 
                  style={{ color: 'var(--danger)', padding: '6px', minHeight: 'auto' }}
                  title="Delete Account"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

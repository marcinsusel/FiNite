import React, { useState } from 'react';
import { Landmark, Plus, Trash2, CreditCard, PiggyBank, Receipt, Briefcase, Calendar, X, Edit2, ExternalLink } from 'lucide-react';

const addMonths = (dateStr, months) => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
};

const generateLoanBalances = (startingDate, startingBalance, apr, lengthMonths) => {
  const balances = [];
  const P = parseFloat(startingBalance);
  const aprVal = parseFloat(apr);
  const length = parseInt(lengthMonths, 10);
  const r = aprVal / 100 / 12;

  let monthlyPayment = 0;
  if (aprVal === 0 || r === 0) {
    monthlyPayment = P / length;
  } else {
    monthlyPayment = P * (r * Math.pow(1 + r, length)) / (Math.pow(1 + r, length) - 1);
  }

  let remainingPrincipal = P;

  // Month 0
  balances.push({
    id: `bal_init_${Math.random().toString(36).substr(2, 9)}`,
    date: startingDate,
    balance: -Number(remainingPrincipal.toFixed(2)) // Loan balance is negative liability
  });

  // Month 1 to length
  for (let k = 1; k <= length; k++) {
    if (k === length) {
      remainingPrincipal = 0;
    } else {
      const interestAdded = remainingPrincipal * r;
      remainingPrincipal = remainingPrincipal * (1 + r) - monthlyPayment;
      if (remainingPrincipal < 0) remainingPrincipal = 0;
    }

    balances.push({
      id: `bal_${k}_${Math.random().toString(36).substr(2, 9)}`,
      date: addMonths(startingDate, k),
      balance: -Number(remainingPrincipal.toFixed(2))
    });
  }

  return {
    monthlyPayment,
    balances
  };
};

export default function AccountManager({ accounts, onSaveAccounts, transactions = [], onDeleteTransaction, onUpdateTransaction, onDeleteAccount }) {
  const [name, setName] = useState('');
  const [bank, setBank] = useState('Chase');
  const [type, setType] = useState('checking');
  const [url, setUrl] = useState('');

  // Edit Account Form states
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editBank, setEditBank] = useState('Chase');
  const [reverseAmounts, setReverseAmounts] = useState(false);
  const [editReverseAmounts, setEditReverseAmounts] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(null);
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [reverseModalTargetValue, setReverseModalTargetValue] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState({});

  // Opening Balance edit states
  const [openingDate, setOpeningDate] = useState('');
  const [openingAmount, setOpeningAmount] = useState('');

  // Manual Balances state
  const [activeAcc, setActiveAcc] = useState(null);
  const [newBalanceDate, setNewBalanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newBalanceValue, setNewBalanceValue] = useState('');

  // Loan Account States
  const [loanStartingDate, setLoanStartingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loanStartingBalance, setLoanStartingBalance] = useState('');
  const [loanApr, setLoanApr] = useState('0');
  const [loanLength, setLoanLength] = useState('12');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (type === 'loan') {
      const { monthlyPayment, balances } = generateLoanBalances(
        loanStartingDate,
        loanStartingBalance,
        loanApr,
        loanLength
      );

      const newAccount = {
        id: `acc_${Math.random().toString(36).substr(2, 9)}`,
        name: name.trim(),
        bank: 'Loan',
        type,
        url: url.trim(),
        startingDate: loanStartingDate,
        startingBalance: parseFloat(loanStartingBalance),
        apr: parseFloat(loanApr),
        lengthMonths: parseInt(loanLength, 10),
        monthlyPayment,
        balances
      };

      onSaveAccounts([...accounts, newAccount]);
      setName('');
      setUrl('');
      setLoanStartingBalance('');
      setLoanApr('0');
      setLoanLength('12');
      return;
    }

    const newAccount = {
      id: `acc_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      bank: type === 'summary' ? 'Manual' : bank,
      type,
      url: url.trim(),
      reverseAmounts: (type !== 'summary' && bank === 'Generic') ? reverseAmounts : false,
      balances: type === 'summary' ? [] : undefined
    };

    onSaveAccounts([...accounts, newAccount]);
    setName('');
    setUrl('');
    setReverseAmounts(false);
  };

  const handleDelete = (id) => {
    const acc = accounts.find(a => a.id === id);
    if (acc) {
      setDeletingAccount(acc);
    }
  };

  const handleConfirmDelete = () => {
    if (!deletingAccount) return;
    if (onDeleteAccount) {
      onDeleteAccount(deletingAccount.id);
    } else {
      onSaveAccounts(accounts.filter(acc => acc.id !== deletingAccount.id));
    }
    if (activeAcc && activeAcc.id === deletingAccount.id) {
      setActiveAcc(null);
    }
    setDeletingAccount(null);
  };

  const handleReverseAmountsToggle = (newCheckedVal) => {
    if (!activeAcc) return;
    const accTxs = transactions.filter(t => t.accountId === activeAcc.id);
    if (accTxs.length === 0) {
      setEditReverseAmounts(newCheckedVal);
      return;
    }

    setReverseModalTargetValue(newCheckedVal);
    // By default, select all transactions to be flipped
    const defaultSelection = {};
    accTxs.forEach(t => {
      defaultSelection[t.id] = true;
    });
    setSelectedTxIds(defaultSelection);
    setShowReverseModal(true);
  };

  const handleConfirmReverseModal = () => {
    if (!activeAcc) return;

    // Apply flips to chosen transactions
    const accTxs = transactions.filter(t => t.accountId === activeAcc.id);
    accTxs.forEach(tx => {
      if (selectedTxIds[tx.id]) {
        const flippedTx = {
          ...tx,
          amount: Math.round(-tx.amount * 100) / 100,
          splits: tx.splits?.map(s => ({
            ...s,
            amount: Math.round(-s.amount * 100) / 100
          }))
        };
        if (onUpdateTransaction) {
          onUpdateTransaction(flippedTx);
        }
      }
    });

    // Update settings in state and parent
    setEditReverseAmounts(reverseModalTargetValue);
    const updatedAccount = {
      ...activeAcc,
      reverseAmounts: reverseModalTargetValue
    };
    onSaveAccounts(accounts.map(acc => acc.id === activeAcc.id ? updatedAccount : acc));
    setActiveAcc(updatedAccount);

    setShowReverseModal(false);
  };

  const handleOpenEditDrawer = (acc) => {
    setActiveAcc(acc);
    setEditName(acc.name);
    setEditUrl(acc.url || '');
    setEditBank(acc.bank || 'Chase');
    setEditReverseAmounts(acc.reverseAmounts || false);
    setNewBalanceDate(new Date().toISOString().split('T')[0]);
    setNewBalanceValue('');

    // Pre-populate opening balance fields
    const accTxs = transactions.filter(t => t.accountId === acc.id);
    const openingEntry = accTxs.find(t => t.description === 'OPENING BALANCE BY FINITE');
    if (openingEntry) {
      setOpeningDate(openingEntry.date);
      setOpeningAmount(openingEntry.amount.toString());
    } else {
      setOpeningDate('');
      setOpeningAmount('');
    }
  };

  const handleAmountChange = (val) => {
    setOpeningAmount(val);
    if (val !== '' && !openingDate) {
      const accTxs = transactions.filter(t => t.accountId === activeAcc.id && t.description !== 'OPENING BALANCE BY FINITE');
      const sortedDates = accTxs.map(t => t.date).filter(Boolean).sort();
      const oldestDate = sortedDates.length > 0 ? sortedDates[0] : new Date().toISOString().split('T')[0];
      setOpeningDate(oldestDate);
    }
  };

  const handleSaveChanges = () => {
    if (!editName.trim()) return;

    const updatedAccount = {
      ...activeAcc,
      name: editName.trim(),
      url: editUrl.trim(),
      bank: activeAcc.type === 'summary' ? 'Manual' : editBank,
      reverseAmounts: (activeAcc.type !== 'summary' && editBank === 'Generic') ? editReverseAmounts : false
    };

    onSaveAccounts(accounts.map(acc => acc.id === activeAcc.id ? updatedAccount : acc));

    // Save Opening Balance adjustments
    if (openingDate && openingAmount !== '') {
      const amtVal = Math.round(parseFloat(openingAmount) * 100) / 100;
      if (!isNaN(amtVal)) {
        const accTxs = transactions.filter(t => t.accountId === activeAcc.id);
        const openingEntry = accTxs.find(t => t.description === 'OPENING BALANCE BY FINITE');
        
        if (openingEntry) {
          const updatedOpening = {
            ...openingEntry,
            date: openingDate,
            amount: amtVal,
            splits: [
              {
                id: openingEntry.splits?.[0]?.id || `split_${Math.random().toString(36).substr(2, 9)}`,
                amount: amtVal,
                categoryId: openingEntry.splits?.[0]?.categoryId || 'cat-transfer',
                notes: 'Reconciliation Opening Balance (Adjusted)'
              }
            ]
          };
          if (onUpdateTransaction) {
            onUpdateTransaction(updatedOpening);
          }
        } else {
          // Create brand new opening balance transaction
          const newOpening = {
            id: `tx_opening_${Math.random().toString(36).substr(2, 9)}`,
            accountId: activeAcc.id,
            date: openingDate,
            description: 'OPENING BALANCE BY FINITE',
            amount: amtVal,
            checkNumber: '',
            reviewed: true,
            splits: [
              {
                id: `split_${Math.random().toString(36).substr(2, 9)}`,
                amount: amtVal,
                categoryId: 'cat-transfer',
                notes: 'Reconciliation Opening Balance'
              }
            ]
          };
          if (onUpdateTransaction) {
            onUpdateTransaction(newOpening);
          }
        }
      }
    }

    setActiveAcc(updatedAccount);
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

  const handleUpdateLoanStartingDate = (newDate) => {
    if (!newDate) return;
    const { monthlyPayment, balances } = generateLoanBalances(
      newDate,
      activeAcc.startingBalance,
      activeAcc.apr,
      activeAcc.lengthMonths
    );

    const updatedAccount = {
      ...activeAcc,
      startingDate: newDate,
      monthlyPayment,
      balances
    };

    onSaveAccounts(accounts.map(acc => acc.id === activeAcc.id ? updatedAccount : acc));
    setActiveAcc(updatedAccount);
  };

  const getAccountIcon = (type) => {
    switch (type) {
      case 'credit': return <CreditCard size={18} className="text-primary" />;
      case 'savings': return <PiggyBank size={18} className="text-primary" />;
      case 'summary': return <Briefcase size={18} className="text-primary" />;
      case 'loan': return <Landmark size={18} className="text-primary" />;
      default: return <Receipt size={18} className="text-primary" />;
    }
  };

  const checking = accounts.filter(acc => acc.type === 'checking');
  const savings = accounts.filter(acc => acc.type === 'savings');
  const credit = accounts.filter(acc => acc.type === 'credit');
  const summary = accounts.filter(acc => acc.type === 'summary');
  const loans = accounts.filter(acc => acc.type === 'loan');

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
                {acc.url ? (
                  <a 
                    href={acc.url.startsWith('http') ? acc.url : `https://${acc.url}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{ 
                      fontWeight: '600', 
                      fontSize: '0.95rem', 
                      color: 'var(--primary)', 
                      textDecoration: 'underline dotted rgba(99, 102, 241, 0.4)',
                      textUnderlineOffset: '3px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title={`Open ${acc.url} in new window`}
                  >
                    {acc.name}
                    <ExternalLink size={12} style={{ opacity: 0.7 }} />
                  </a>
                ) : (
                  <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{acc.name}</div>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {acc.type === 'summary' ? 'MANUAL' : `Format: ${acc.bank}`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {acc.type !== 'summary' && (() => {
                const accTxs = transactions.filter(t => t.accountId === acc.id);
                if (accTxs.length === 0) {
                  return (
                    <span 
                      style={{ 
                        fontSize: '0.72rem', 
                        color: 'var(--text-muted)', 
                        backgroundColor: 'rgba(255, 255, 255, 0.02)', 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        border: '1px solid var(--border-color)',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      No transactions
                    </span>
                  );
                }
                const dates = accTxs.map(t => t.date).filter(Boolean).sort();
                const earliest = dates[0];
                const latest = dates[dates.length - 1];
                return (
                  <span 
                    style={{ 
                      fontSize: '0.72rem', 
                      color: 'var(--text-muted)', 
                      backgroundColor: 'rgba(99, 102, 241, 0.04)', 
                      border: '1px solid rgba(99, 102, 241, 0.15)',
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                    title="Transaction Date Range"
                  >
                    <Calendar size={12} style={{ color: 'var(--primary)' }} />
                    {earliest} to {latest}
                  </span>
                );
              })()}
              
              <button 
                onClick={() => handleOpenEditDrawer(acc)} 
                className="btn btn-secondary btn-sm" 
                style={{ color: 'var(--text-muted)', padding: '6px', minHeight: 'auto' }}
                title="Edit Account"
              >
                <Edit2 size={16} />
              </button>
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

            {type !== 'summary' && type !== 'loan' && (
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

            {type !== 'summary' && type !== 'loan' && bank === 'Generic' && (
              <div className="form-group fade-in" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                <input 
                  id="accReverseAmounts"
                  type="checkbox"
                  checked={reverseAmounts}
                  onChange={(e) => setReverseAmounts(e.target.checked)}
                  style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
                />
                <label htmlFor="accReverseAmounts" style={{ fontSize: '0.8rem', cursor: 'pointer', userSelect: 'none', marginBottom: 0 }}>
                  Reverse transaction amounts (debits positive / credits negative)
                </label>
              </div>
            )}

            {type === 'loan' && (
              <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label htmlFor="loanStartingDate">Starting Date</label>
                  <input 
                    id="loanStartingDate"
                    type="date" 
                    className="input" 
                    value={loanStartingDate}
                    onChange={(e) => setLoanStartingDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="loanStartingBalance">Starting Balance ($)</label>
                  <input 
                    id="loanStartingBalance"
                    type="number" 
                    step="0.01" 
                    className="input" 
                    placeholder="e.g. 15000.00"
                    value={loanStartingBalance}
                    onChange={(e) => setLoanStartingBalance(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="loanApr">APR (%)</label>
                    <input 
                      id="loanApr"
                      type="number" 
                      step="0.01" 
                      className="input" 
                      value={loanApr}
                      onChange={(e) => setLoanApr(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="loanLength">Length (Months)</label>
                    <input 
                      id="loanLength"
                      type="number" 
                      className="input" 
                      value={loanLength}
                      onChange={(e) => setLoanLength(e.target.value)}
                      required
                    />
                  </div>
                </div>
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
                  if (e.target.value === 'summary' || e.target.value === 'loan') {
                    setBank('Generic');
                  }
                }}
              >
                <option value="checking">Checking Account</option>
                <option value="savings">Savings Account</option>
                <option value="credit">Credit Card</option>
                <option value="summary">Summary Account (Manual)</option>
                <option value="loan">Loan Account (Amortized)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="accUrl">Login URL (Optional)</label>
              <input 
                id="accUrl"
                type="text" 
                className="input" 
                placeholder="e.g. https://www.chase.com" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
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
              {renderAccountGroup('Amortized Loan Accounts', loans)}
            </div>
          )}
        </div>
      </div>

      {/* Drawer Overlay for Editing Account Details and Balances */}
      {activeAcc && (
        <div className="split-drawer-overlay" onClick={() => setActiveAcc(null)}>
          <div className="split-drawer" onClick={(e) => e.stopPropagation()}>
            
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem' }}>Edit Account</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{activeAcc.name}</span>
              </div>
              <button onClick={() => setActiveAcc(null)} className="btn btn-secondary btn-sm" style={{ padding: '6px', minHeight: 'auto' }}>
                <X size={16} />
              </button>
            </div>

            {/* Edit Account Details Form */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', backgroundColor: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', fontWeight: '600' }}>Account Settings</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Account Name</label>
                  <input 
                    type="text" 
                    className="input" 
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>

                {activeAcc.type !== 'summary' && activeAcc.type !== 'loan' && (
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Bank CSV Mapping Format</label>
                    <select 
                      className="input select"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      value={editBank}
                      onChange={(e) => setEditBank(e.target.value)}
                    >
                      <option value="Chase">Chase Bank</option>
                      <option value="Prosperity">Prosperity Bank</option>
                      <option value="Citi">Citi Card</option>
                      <option value="Generic">Generic CSV (Guesses mapping)</option>
                    </select>
                  </div>
                )}

                {activeAcc.type !== 'summary' && activeAcc.type !== 'loan' && editBank === 'Generic' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <input 
                      id="editAccReverseAmounts"
                      type="checkbox"
                      checked={editReverseAmounts}
                      onChange={(e) => handleReverseAmountsToggle(e.target.checked)}
                      style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
                    />
                    <label htmlFor="editAccReverseAmounts" style={{ fontSize: '0.78rem', cursor: 'pointer', userSelect: 'none', marginBottom: 0 }}>
                      Reverse transaction amounts (debits positive / credits negative)
                    </label>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Login URL</label>
                  <input 
                    type="text" 
                    className="input" 
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                    placeholder="e.g. https://www.chase.com" 
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                  />
                </div>

                {activeAcc.type !== 'summary' && activeAcc.type !== 'loan' && (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Opening Balance Date</label>
                      <input 
                        type="date" 
                        className="input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                        value={openingDate}
                        onChange={(e) => setOpeningDate(e.target.value)}
                        required
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Opening Balance Amount ($)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        className="input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                        value={openingAmount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}

                <button 
                  onClick={handleSaveChanges} 
                  className="btn btn-primary btn-sm"
                  style={{ alignSelf: 'flex-end', marginTop: '4px' }}
                >
                  Save Account Details
                </button>
              </div>
            </div>

            {/* Manual Balances Section */}
            {activeAcc.type === 'summary' && (
              <>
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
              </>
            )}

            {/* Amortized Loan History Section */}
            {activeAcc.type === 'loan' && (() => {
              const formatCurrency = (val) => {
                const absVal = Math.abs(val);
                const formatted = absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return (val < 0 ? '-' : '') + '$' + formatted;
              };
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', flexGrow: 1, overflowY: 'auto' }}>
                  {/* Loan Stats Panel */}
                  <div className="card" style={{ padding: '1.25rem', backgroundColor: 'rgba(99, 102, 241, 0.02)', border: '1px solid var(--border-color)', marginBottom: '8px' }}>
                    <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Loan Amortization Details
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Starting Date:</span>
                        <input 
                          type="date"
                          className="input"
                          style={{ 
                            marginLeft: '6px', 
                            padding: '2px 6px', 
                            fontSize: '0.85rem', 
                            height: '24px', 
                            width: '125px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            color: 'var(--text-main)',
                            display: 'inline-block',
                            verticalAlign: 'middle',
                            cursor: 'pointer'
                          }}
                          value={activeAcc.startingDate}
                          onChange={(e) => handleUpdateLoanStartingDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Amortization Term:</span>
                        <strong style={{ marginLeft: '6px', color: 'var(--text-main)' }}>{activeAcc.lengthMonths} Months</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Starting Principal:</span>
                        <strong style={{ marginLeft: '6px', color: 'var(--text-main)' }}>{formatCurrency(activeAcc.startingBalance || 0)}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Annual APR:</span>
                        <strong style={{ marginLeft: '6px', color: 'var(--text-main)' }}>{activeAcc.apr}%</strong>
                      </div>
                      <div style={{ gridColumn: 'span 2', borderTop: '1px dashed var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Calculated Static Payment:</span>
                        <strong style={{ marginLeft: '6px', color: 'var(--success)', fontSize: '0.95rem' }}>{formatCurrency(activeAcc.monthlyPayment || 0)}/mo</strong>
                      </div>
                    </div>
                  </div>

                  {/* Historical/Amortized Balance Entries List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexGrow: 1 }}>
                    <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Amortization Schedule</h4>
                    
                    <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflowY: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Payment Month</th>
                            <th>Date</th>
                            <th style={{ textAlign: 'right' }}>Remaining Principal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...(activeAcc.balances || [])].map((entry, idx) => (
                            <tr key={entry.id}>
                              <td style={{ fontWeight: '600' }}>Month {idx}</td>
                              <td style={{ color: 'var(--text-muted)' }}>{entry.date}</td>
                              <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--danger)' }}>
                                {formatCurrency(entry.balance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Non-Manual History Section */}
            {activeAcc.type !== 'summary' && activeAcc.type !== 'loan' && (() => {
              const accTxs = transactions.filter(t => t.accountId === activeAcc.id);
              const openingEntry = accTxs.find(t => t.description === 'OPENING BALANCE BY FINITE');
              const openingAmount = openingEntry ? openingEntry.amount : 0;
              const openingDate = openingEntry ? openingEntry.date : '--';

              const otherTxs = accTxs.filter(t => t.description !== 'OPENING BALANCE BY FINITE');
              const otherTotal = otherTxs.reduce((sum, t) => sum + t.amount, 0);
              const otherDates = otherTxs.map(t => t.date).filter(Boolean).sort();
              const dateRange = otherDates.length > 0 
                ? `${otherDates[0]} to ${otherDates[otherDates.length - 1]}` 
                : 'No transaction activity';

              const endingBalance = openingAmount + otherTotal;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexGrow: 1, overflowY: 'auto' }}>
                  <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                    Account History Ledger
                  </h4>
                  
                  <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Date / Range</th>
                          <th>Entry Description</th>
                          <th style={{ textAlign: 'right' }}>Calculated Total</th>
                          <th style={{ width: '50px', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Opening Balance Row */}
                        <tr>
                          <td style={{ fontWeight: '500' }}>{openingDate}</td>
                          <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                            OPENING BALANCE BY FINITE
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }} className={openingAmount >= 0 ? 'amt-inflow' : 'amt-outflow'}>
                            {openingAmount < 0 ? '-' : ''}${Math.abs(openingAmount).toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            --
                          </td>
                        </tr>

                        {/* Transaction Activity Row */}
                        <tr>
                          <td style={{ fontWeight: '500', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {dateRange}
                          </td>
                          <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                            Transaction Activity ({otherTxs.length} items)
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }} className={otherTotal >= 0 ? 'amt-inflow' : 'amt-outflow'}>
                            {otherTotal < 0 ? '-' : ''}${Math.abs(otherTotal).toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            --
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Ending Balance Summary Footer */}
                  <div 
                    style={{ 
                      marginTop: '0.5rem', 
                      padding: '12px 1rem', 
                      borderRadius: '6px', 
                      backgroundColor: 'rgba(255, 255, 255, 0.02)', 
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      Calculated Ending Balance:
                    </span>
                    <strong 
                      style={{ fontSize: '1.15rem' }} 
                      className={endingBalance >= 0 ? 'amt-inflow' : 'amt-outflow'}
                    >
                      {endingBalance < 0 ? '-' : ''}${Math.abs(endingBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              );
            })()}
            
          </div>
        </div>
      )}

      {/* Account Deletion Confirmation Modal */}
      {deletingAccount && (() => {
        const accTxs = transactions.filter(t => t.accountId === deletingAccount.id);
        const debits = accTxs.filter(t => t.amount < 0);
        const credits = accTxs.filter(t => t.amount > 0);
        const totalDebits = debits.reduce((sum, t) => sum + t.amount, 0);
        const totalCredits = credits.reduce((sum, t) => sum + t.amount, 0);

        return (
          <div className="confirm-modal-overlay" onClick={() => setDeletingAccount(null)}>
            <div className="confirm-modal-card" onClick={(e) => e.stopPropagation()}>
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                  <Trash2 size={20} />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>Permanently Delete Account?</h3>
                </div>
                <button onClick={() => setDeletingAccount(null)} className="btn btn-secondary btn-sm" style={{ padding: '6px', minHeight: 'auto' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Warning Alert Banner */}
              <div className="warning-banner">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--danger)' }}>CRITICAL ACTION REQUIRED</strong>
                  <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Deleting this account is permanent. It will instantly remove all ledger references, historical balance entries, and purges all {accTxs.length} associated transactions from your database.
                  </span>
                </div>
              </div>

              {/* Account Details Details Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 2px 0', fontWeight: '700' }}>Account Settings Details</h4>
                <div className="confirm-details-grid">
                  <div className="confirm-details-item">
                    <span className="confirm-details-label">Name</span>
                    <span className="confirm-details-value">{deletingAccount.name}</span>
                  </div>
                  <div className="confirm-details-item">
                    <span className="confirm-details-label">Account Type</span>
                    <span className="confirm-details-value" style={{ textTransform: 'capitalize' }}>{deletingAccount.type}</span>
                  </div>
                  <div className="confirm-details-item">
                    <span className="confirm-details-label">Mapping Format</span>
                    <span className="confirm-details-value">{deletingAccount.bank || 'Manual'}</span>
                  </div>
                  <div className="confirm-details-item">
                    <span className="confirm-details-label">Login URL</span>
                    <span className="confirm-details-value" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {deletingAccount.url || 'Not configured'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Statistics Row */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 2px 0', fontWeight: '700' }}>Impact Summary</h4>
                <div className="confirm-stats-row">
                  <div className="confirm-stat-card">
                    <span className="confirm-stat-label">Transactions</span>
                    <div className="confirm-stat-value" style={{ color: 'var(--text-main)' }}>{accTxs.length}</div>
                  </div>
                  <div className="confirm-stat-card">
                    <span className="confirm-stat-label">Debits Total</span>
                    <div className="confirm-stat-value amt-outflow">-${Math.abs(totalDebits).toFixed(2)}</div>
                  </div>
                  <div className="confirm-stat-card">
                    <span className="confirm-stat-label">Credits Total</span>
                    <div className="confirm-stat-value amt-inflow">+${Math.abs(totalCredits).toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Scrollable Transaction Log */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexGrow: 1 }}>
                <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 2px 0', fontWeight: '700' }}>Associated Transactions List</h4>
                {accTxs.length === 0 ? (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
                    No transactions associated with this account.
                  </div>
                ) : (
                  <div className="confirm-tx-list">
                    {accTxs.map((tx) => (
                      <div key={tx.id} className="confirm-tx-row">
                        <span style={{ fontWeight: '500', opacity: 0.8 }}>{tx.date}</span>
                        <span style={{ fontWeight: '600', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={tx.description}>
                          {tx.description}
                        </span>
                        <span style={{ textAlign: 'right', fontWeight: '700' }} className={tx.amount >= 0 ? 'amt-inflow' : 'amt-outflow'}>
                          {tx.amount < 0 ? '-' : ''}${Math.abs(tx.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <button 
                  onClick={() => setDeletingAccount(null)} 
                  className="btn btn-secondary"
                  style={{ minWidth: '100px' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmDelete} 
                  className="btn btn-primary"
                  style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff', minWidth: '180px' }}
                >
                  <Trash2 size={16} />
                  Delete Everything
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Reverse amounts sign alignment modal */}
      {showReverseModal && (() => {
        const accTxs = transactions.filter(t => t.accountId === activeAcc.id);
        const selectedCount = Object.values(selectedTxIds).filter(Boolean).length;
        
        return (
          <div className="confirm-modal-overlay" onClick={() => setShowReverseModal(false)}>
            <div className="confirm-modal-card" onClick={(e) => e.stopPropagation()}>
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                  <Landmark size={20} />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>Align Transaction Signs</h3>
                </div>
                <button onClick={() => setShowReverseModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '6px', minHeight: 'auto' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Warning alert banner */}
              <div className="warning-banner" style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', color: 'var(--warning)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--warning)' }}>ATTENTION: SIGN REVERSAL REQUIRED</strong>
                  <span style={{ fontSize: '0.8rem', opacity: 0.9, color: 'var(--text-main)' }}>
                    Changing the "Reverse transaction amounts" setting affects how incoming CSV file imports are processed. 
                    To align your existing ledger with this change, you should negate the positive/negative signs of existing transactions for this account.
                  </span>
                </div>
              </div>

              {/* Selection Summary and bulk triggers */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                  Updating <strong className="text-primary">{selectedCount}</strong> of <strong className="text-primary">{accTxs.length}</strong> transactions
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => {
                      const allOn = {};
                      accTxs.forEach(t => { allOn[t.id] = true; });
                      setSelectedTxIds(allOn);
                    }} 
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '4px 8px', minHeight: 'auto' }}
                  >
                    Select All
                  </button>
                  <button 
                    onClick={() => {
                      const allOff = {};
                      accTxs.forEach(t => { allOff[t.id] = false; });
                      setSelectedTxIds(allOff);
                    }} 
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '4px 8px', minHeight: 'auto' }}
                  >
                    Select None
                  </button>
                </div>
              </div>

              {/* Scrollable Transaction list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexGrow: 1 }}>
                <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 2px 0', fontWeight: '700' }}>
                  Reconciliation Preview Ledger
                </h4>
                <div className="confirm-tx-list" style={{ maxHeight: '260px' }}>
                  {/* Ledger Header Row */}
                  <div className="confirm-tx-row" style={{ borderBottom: '1px solid var(--border-color)', fontWeight: '700', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.03em', backgroundColor: 'rgba(255,255,255,0.01)', gridTemplateColumns: '40px 1fr 180px' }}>
                    <span style={{ textAlign: 'center' }}>Apply</span>
                    <span>Date / Payee</span>
                    <span style={{ textAlign: 'right' }}>Before &rarr; After Amount</span>
                  </div>
                  
                  {accTxs.map((tx) => {
                    const isFlipped = selectedTxIds[tx.id] || false;
                    const afterVal = isFlipped ? -tx.amount : tx.amount;
                    return (
                      <div key={tx.id} className="confirm-tx-row" style={{ gridTemplateColumns: '40px 1fr 180px' }}>
                        {/* Checkbox selector */}
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <input 
                            type="checkbox"
                            checked={isFlipped}
                            onChange={(e) => setSelectedTxIds(prev => ({
                              ...prev,
                              [tx.id]: e.target.checked
                            }))}
                            style={{ margin: 0, width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                        </div>
                        {/* Transaction Date and Description */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{tx.date}</span>
                          <span style={{ fontWeight: '600', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={tx.description}>
                            {tx.description}
                          </span>
                        </div>
                        {/* Before -> After Comparison */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', fontSize: '0.82rem', fontWeight: '600' }}>
                          <span className={tx.amount >= 0 ? 'amt-inflow' : 'amt-outflow'}>
                            {tx.amount < 0 ? '-' : ''}${Math.abs(tx.amount).toFixed(2)}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>&rarr;</span>
                          <span className={afterVal >= 0 ? 'amt-inflow' : 'amt-outflow'} style={{ borderBottom: isFlipped ? '1px dashed var(--border-focus)' : 'none' }}>
                            {afterVal < 0 ? '-' : ''}${Math.abs(afterVal).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <button 
                  onClick={() => setShowReverseModal(false)} 
                  className="btn btn-secondary"
                  style={{ minWidth: '100px' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmReverseModal} 
                  className="btn btn-primary"
                  style={{ minWidth: '180px' }}
                >
                  Apply Sign Changes
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </>
  );
}

import React, { useState } from 'react';
import { Filter, Calendar, Search, Edit3, Trash2, Plus, Check, X, AlertCircle } from 'lucide-react';

export default function TransactionList({ 
  transactions, 
  accounts, 
  categories, 
  onAddCategory,
  onUpdateTransaction,
  onDeleteTransaction 
}) {
  // Filter States
  const [filterAccount, setFilterAccount] = useState(() => localStorage.getItem('finite_filter_account') || 'all');
  const [filterCategory, setFilterCategory] = useState(() => localStorage.getItem('finite_filter_category') || 'all');
  const [filterReviewed, setFilterReviewed] = useState(() => localStorage.getItem('finite_filter_reviewed') || 'all');
  const [filterSearch, setFilterSearch] = useState(() => localStorage.getItem('finite_filter_search') || '');
  const [startDate, setStartDate] = useState(() => localStorage.getItem('finite_filter_start_date') || '');
  const [endDate, setEndDate] = useState(() => localStorage.getItem('finite_filter_end_date') || '');

  React.useEffect(() => {
    localStorage.setItem('finite_filter_account', filterAccount);
    localStorage.setItem('finite_filter_category', filterCategory);
    localStorage.setItem('finite_filter_reviewed', filterReviewed);
    localStorage.setItem('finite_filter_search', filterSearch);
    localStorage.setItem('finite_filter_start_date', startDate);
    localStorage.setItem('finite_filter_end_date', endDate);
  }, [filterAccount, filterCategory, filterReviewed, filterSearch, startDate, endDate]);

  // Active Transaction for Split Drawer
  const [activeTx, setActiveTx] = useState(null);
  const [tempSplits, setTempSplits] = useState([]);

  // Inline category creation states
  const [inlineNewCatForSplit, setInlineNewCatForSplit] = useState(null); // splitId
  const [inlineNewCatName, setInlineNewCatName] = useState('');

  const handleSaveInlineCategory = (splitId) => {
    const trimmed = inlineNewCatName.trim();
    if (!trimmed) {
      setInlineNewCatForSplit(null);
      setInlineNewCatName('');
      return;
    }

    // Check case-insensitive duplicates
    const duplicate = categories.find(
      c => c.name.toLowerCase() === trimmed.toLowerCase()
    );

    if (duplicate) {
      alert(`A category named "${duplicate.name}" already exists.`);
      return;
    }

    const newId = `custom_${Math.random().toString(36).substr(2, 9)}`;
    
    // 1. Add it to global state
    onAddCategory({
      id: newId,
      name: trimmed
    });

    // 2. Select it in this split
    handleUpdateSplitField(splitId, 'categoryId', newId);

    // 3. Reset states
    setInlineNewCatForSplit(null);
    setInlineNewCatName('');
  };

  // Open the split editor drawer
  const handleOpenDrawer = (tx) => {
    setActiveTx(tx);
    // Clone splits for editing
    setTempSplits(tx.splits.map(s => ({ ...s })));
  };

  // Close the split editor drawer
  const handleCloseDrawer = () => {
    setActiveTx(null);
    setTempSplits([]);
    setInlineNewCatForSplit(null);
    setInlineNewCatName('');
  };

  // Add a new split row
  const handleAddSplit = () => {
    // Default the remaining amount to the new split
    const sumCurrent = tempSplits.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const remaining = Number((activeTx.amount - sumCurrent).toFixed(2));

    const newSplit = {
      id: `split_${Math.random().toString(36).substr(2, 9)}`,
      amount: remaining,
      categoryId: 'cat-uncategorized',
      notes: ''
    };
    setTempSplits([...tempSplits, newSplit]);
  };

  // Delete a split row
  const handleDeleteSplit = (splitId) => {
    if (tempSplits.length <= 1) return;
    setTempSplits(tempSplits.filter(s => s.id !== splitId));
  };

  // Update a single split field
  const handleUpdateSplitField = (splitId, field, value) => {
    setTempSplits(tempSplits.map(s => {
      if (s.id === splitId) {
        let parsedVal = value;
        if (field === 'amount') {
          // Keep as string or number during typing
          parsedVal = value === '' ? '' : parseFloat(value);
        }
        return { ...s, [field]: parsedVal };
      }
      return s;
    }));
  };

  // Save the splits allocation
  const handleSaveSplits = () => {
    // 1. Validate sum
    const totalSplits = tempSplits.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const discrepancy = Math.abs(activeTx.amount - totalSplits);

    if (discrepancy > 0.009) {
      alert(`Cannot save splits. Total splits must equal the transaction amount of $${activeTx.amount.toFixed(2)}. Current total is $${totalSplits.toFixed(2)}.`);
      return;
    }

    // 2. Save
    const updatedTx = {
      ...activeTx,
      splits: tempSplits.map(s => ({
        ...s,
        amount: Number(Number(s.amount).toFixed(2)) // force float rounding
      }))
    };

    onUpdateTransaction(updatedTx);
    handleCloseDrawer();
  };

  const handleDeleteTx = () => {
    if (window.confirm('Are you sure you want to delete this transaction permanently?')) {
      onDeleteTransaction(activeTx.id);
      handleCloseDrawer();
    }
  };

  const handleDrawerKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (inlineNewCatForSplit !== null) {
        return;
      }
      e.preventDefault();
      if (activeTx.reviewed) {
        handleCloseDrawer();
      } else if (isBalanced) {
        handleSaveSplits();
      }
    }
  };


  // Filter Logic
  const filteredTransactions = transactions.filter(tx => {
    // Account filter
    if (filterAccount !== 'all' && tx.accountId !== filterAccount) return false;

    // Category filter (checks if ANY split contains the category ID)
    if (filterCategory !== 'all') {
      const hasCat = tx.splits.some(s => s.categoryId === filterCategory);
      if (!hasCat) return false;
    }

    // Date range filter
    if (startDate && tx.date < startDate) return false;
    if (endDate && tx.date > endDate) return false;

    // Search filter
    if (filterSearch) {
      const query = filterSearch.toLowerCase();
      const inDesc = tx.description.toLowerCase().includes(query);
      const inNotes = tx.splits.some(s => (s.notes || '').toLowerCase().includes(query));
      if (!inDesc && !inNotes) return false;
    }

    // Review filter
    if (filterReviewed !== 'all') {
      const isReviewed = !!tx.reviewed;
      if (filterReviewed === 'reviewed' && !isReviewed) return false;
      if (filterReviewed === 'needs-review' && isReviewed) return false;
    }

    return true;
  });

  // Helper names
  const getAccountName = (id) => {
    const acc = accounts.find(a => a.id === id);
    return acc ? acc.name : 'Unknown Account';
  };

  const getCategoryName = (id) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.name : 'Unknown Category';
  };

  const getTransactionCategoriesString = (tx) => {
    if (tx.splits.length === 1) {
      return getCategoryName(tx.splits[0].categoryId);
    }
    const names = tx.splits.map(s => getCategoryName(s.categoryId));
    const uniqueNames = Array.from(new Set(names));
    if (uniqueNames.length === 1) return uniqueNames[0];
    return `Split (${tx.splits.length}): ${uniqueNames.join(', ')}`;
  };

  // Calculating allocations inside drawer
  const currentSplitsTotal = tempSplits.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const remainingToAllocate = activeTx ? Number((activeTx.amount - currentSplitsTotal).toFixed(2)) : 0;
  const isBalanced = activeTx ? Math.abs(remainingToAllocate) < 0.009 : false;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flexGrow: 1 }}>
      
      {/* Filters Toolbar Card */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          
          {/* Search Input */}
          <div style={{ flexGrow: 1, minWidth: '220px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="input" 
              style={{ paddingLeft: '32px' }}
              placeholder="Search description or notes..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
          </div>

          {/* Account Filter */}
          <div style={{ minWidth: '160px' }}>
            <select 
              className="input select"
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
            >
              <option value="all">All Accounts</option>
              {accounts.filter(acc => acc.type !== 'summary').map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div style={{ minWidth: '160px' }}>
            <select 
              className="input select"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Review Status Filter */}
          <div style={{ minWidth: '160px' }}>
            <select 
              className="input select"
              value={filterReviewed}
              onChange={(e) => setFilterReviewed(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="needs-review">Needs Review</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </div>

          {/* Date Inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} className="text-muted" />
            <input 
              type="date" 
              className="input" 
              style={{ width: '130px', padding: '0.45rem 0.65rem' }} 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)' }}>to</span>
            <input 
              type="date" 
              className="input" 
              style={{ width: '130px', padding: '0.45rem 0.65rem' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

        </div>
      </div>

      {/* Main Transactions Log Table */}
      <div className="card" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', padding: 0 }}>
        <div className="table-container" style={{ flexGrow: 1, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Date</th>
                <th>Description</th>
                <th>Category Distribution</th>
                <th>Amount</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Reviewed</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                    No transactions match your active filters.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(tx => (
                  <tr key={tx.id}>
                    <td>
                      <span style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', fontWeight: '500' }}>
                        {getAccountName(tx.accountId)}
                      </span>
                    </td>
                    <td style={{ fontWeight: '500' }}>{tx.date}</td>
                    <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.description}>
                      {tx.description}
                    </td>
                    <td style={{ color: tx.splits.length > 1 ? 'var(--primary)' : 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {getTransactionCategoriesString(tx)}
                    </td>
                    <td className={tx.amount < 0 ? 'amt-outflow' : 'amt-inflow'}>
                      {tx.amount < 0 ? '-' : ''}${Math.abs(tx.amount).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={!!tx.reviewed}
                        onChange={(e) => {
                          onUpdateTransaction({
                            ...tx,
                            reviewed: e.target.checked
                          });
                        }}
                        style={{ 
                          width: '18px', 
                          height: '18px', 
                          cursor: 'pointer',
                          accentColor: 'var(--primary)',
                          verticalAlign: 'middle'
                        }}
                        title={tx.reviewed ? "Mark as Needs Review" : "Mark as Reviewed"}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => handleOpenDrawer(tx)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '6px', minHeight: 'auto' }}
                        title="Split & Categorize"
                      >
                        <Edit3 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Showing {filteredTransactions.length} of {transactions.length} transactions</span>
          <span>Net Sum: <strong>{filteredTransactions.reduce((s, t) => s + t.amount, 0) < 0 ? '-' : ''}${Math.abs(filteredTransactions.reduce((s, t) => s + t.amount, 0)).toFixed(2)}</strong></span>
        </div>
      </div>

      {/* Drawer Overlay for Splits */}
      {activeTx && (
        <div className="split-drawer-overlay" onClick={handleCloseDrawer}>
          <div 
            className="split-drawer" 
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleDrawerKeyDown}
          >
            
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem' }}>Transaction Splits</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{getAccountName(activeTx.accountId)}</span>
              </div>
              <button onClick={handleCloseDrawer} className="btn btn-secondary btn-sm" style={{ padding: '6px', minHeight: 'auto' }}>
                <X size={16} />
              </button>
            </div>

            {/* Transaction Info Summary */}
            <div className="compare-card" style={{ backgroundColor: 'rgba(255,255,255,0.01)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontWeight: '600' }}>{activeTx.date}</span>
                <span className={activeTx.amount < 0 ? 'amt-outflow' : 'amt-inflow'} style={{ fontSize: '1.1rem', fontWeight: '700' }}>
                  {activeTx.amount < 0 ? '-' : ''}${Math.abs(activeTx.amount).toFixed(2)}
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{activeTx.description}</div>
              {activeTx.checkNumber && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Check Number: #{activeTx.checkNumber}</div>
              )}
            </div>

            {/* Reviewed Toggle Banner */}
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                padding: '10px 14px', 
                backgroundColor: activeTx.reviewed ? 'rgba(99, 102, 241, 0.08)' : 'rgba(245, 158, 11, 0.08)', 
                border: `1px solid ${activeTx.reviewed ? 'rgba(99, 102, 241, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`, 
                borderRadius: '8px', 
                fontSize: '0.9rem',
                marginBottom: '0.75rem'
              }}
            >
              <input 
                type="checkbox" 
                id="drawerReviewed"
                checked={!!activeTx.reviewed}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  const updatedTx = { ...activeTx, reviewed: isChecked };
                  setActiveTx(updatedTx);
                  onUpdateTransaction(updatedTx);
                }}
                style={{ 
                  width: '18px', 
                  height: '18px', 
                  cursor: 'pointer',
                  accentColor: 'var(--primary)'
                }}
              />
              <label 
                htmlFor="drawerReviewed" 
                style={{ 
                  cursor: 'pointer', 
                  fontWeight: '600', 
                  color: activeTx.reviewed ? 'var(--primary)' : 'var(--warning)',
                  userSelect: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {activeTx.reviewed ? '🔒 Reviewed (Locked)' : '⚠️ Needs Review (Unlocked)'}
              </label>
            </div>

            {/* Split Rows Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1, overflowY: 'auto' }}>
              <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Allocations</h4>
              
              {tempSplits.map((split, index) => (
                <div key={split.id} className="split-row">
                  {/* Category Dropdown or Inline Input */}
                  {inlineNewCatForSplit === split.id ? (
                    <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                      <input 
                        type="text"
                        className="input"
                        placeholder="New category..."
                        style={{ fontSize: '0.85rem', padding: '0.4rem' }}
                        value={inlineNewCatName}
                        onChange={(e) => setInlineNewCatName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSaveInlineCategory(split.id);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            e.stopPropagation();
                            setInlineNewCatForSplit(null);
                            setInlineNewCatName('');
                          }
                        }}
                        disabled={activeTx.reviewed}
                        autoFocus
                      />
                      <button 
                        onClick={() => handleSaveInlineCategory(split.id)}
                        disabled={activeTx.reviewed}
                        className="btn btn-primary"
                        style={{ padding: '6px', minHeight: 'auto' }}
                        title="Save Category"
                      >
                        <Check size={14} />
                      </button>
                      <button 
                        onClick={() => {
                          setInlineNewCatForSplit(null);
                          setInlineNewCatName('');
                        }}
                        disabled={activeTx.reviewed}
                        className="btn btn-secondary"
                        style={{ padding: '6px', minHeight: 'auto' }}
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <select 
                      className="input select"
                      style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                      value={split.categoryId}
                      disabled={activeTx.reviewed}
                      onChange={(e) => {
                        if (e.target.value === 'ADD_NEW_CAT') {
                          setInlineNewCatForSplit(split.id);
                          setInlineNewCatName('');
                        } else {
                          handleUpdateSplitField(split.id, 'categoryId', e.target.value);
                        }
                      }}
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                      <option value="ADD_NEW_CAT" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                        + Add New Category...
                      </option>
                    </select>
                  )}

                  {/* Amount Input */}
                  <input 
                    type="number" 
                    step="0.01" 
                    className="input" 
                    style={{ fontSize: '0.85rem', padding: '0.5rem', textAlign: 'right' }}
                    value={split.amount}
                    disabled={activeTx.reviewed}
                    onChange={(e) => handleUpdateSplitField(split.id, 'amount', e.target.value)}
                    placeholder="0.00"
                  />

                  {/* Delete Button */}
                  <button 
                    onClick={() => handleDeleteSplit(split.id)}
                    disabled={activeTx.reviewed || tempSplits.length <= 1}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '6px', color: (tempSplits.length <= 1 || activeTx.reviewed) ? 'var(--text-muted)' : 'var(--danger)', opacity: (tempSplits.length <= 1 || activeTx.reviewed) ? 0.3 : 1, minHeight: 'auto' }}
                  >
                    <Trash2 size={14} />
                  </button>

                  {/* Note Input */}
                  <input 
                    type="text" 
                    className="input" 
                    style={{ gridColumn: 'span 3', fontSize: '0.8rem', padding: '4px 8px', marginTop: '2px', opacity: 0.8 }}
                    value={split.notes}
                    disabled={activeTx.reviewed}
                    onChange={(e) => handleUpdateSplitField(split.id, 'notes', e.target.value)}
                    placeholder="Add split notes/description..."
                  />
                </div>
              ))}

              <button 
                onClick={handleAddSplit} 
                disabled={activeTx.reviewed}
                className="btn btn-secondary btn-sm" 
                style={{ alignSelf: 'flex-start', borderStyle: 'dashed', opacity: activeTx.reviewed ? 0.4 : 1 }}
              >
                <Plus size={14} />
                Add Split Line
              </button>
            </div>

            {/* Split Sum Validation Alert */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px' }}>
                <span>Allocated:</span>
                <span>${currentSplitsTotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '12px' }}>
                <span>Remaining:</span>
                <span style={{ color: isBalanced ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
                  ${remainingToAllocate.toFixed(2)}
                </span>
              </div>

              {!isBalanced && (
                <div style={{ display: 'flex', gap: '8px', padding: '10px', backgroundColor: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--danger)', marginBottom: '1.25rem' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>The split sums do not equal the transaction amount of ${activeTx.amount.toFixed(2)}. Discrepancy: ${remainingToAllocate.toFixed(2)}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                <button 
                  onClick={handleDeleteTx} 
                  disabled={activeTx.reviewed}
                  className="btn btn-secondary" 
                  style={{ color: activeTx.reviewed ? 'var(--text-muted)' : 'var(--danger)', opacity: activeTx.reviewed ? 0.3 : 1, cursor: activeTx.reviewed ? 'not-allowed' : 'pointer' }}
                  title={activeTx.reviewed ? "Reviewed transactions cannot be deleted" : "Delete transaction permanently"}
                >
                  <Trash2 size={16} />
                </button>
                
                <div style={{ display: 'flex', gap: '10px', flexGrow: 1, justifyContent: 'flex-end' }}>
                  <button onClick={handleCloseDrawer} className="btn btn-secondary">
                    {activeTx.reviewed ? 'Close' : 'Cancel'}
                  </button>
                  <button 
                    onClick={handleSaveSplits} 
                    disabled={activeTx.reviewed || !isBalanced}
                    className="btn btn-primary"
                    style={{ flexGrow: 1, opacity: (isBalanced && !activeTx.reviewed) ? 1 : 0.4, cursor: (isBalanced && !activeTx.reviewed) ? 'pointer' : 'not-allowed' }}
                  >
                    <Check size={16} />
                    Save Splits
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

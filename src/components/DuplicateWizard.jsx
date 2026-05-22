import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck, Check, ArrowRight, X, Copy, Trash2, HelpCircle } from 'lucide-react';
import { getAutoCategoryId } from '../utils/autoCategorizer';

export default function DuplicateWizard({ 
  pendingTransactions, 
  account, 
  categories,
  onCompleteImport, 
  onCancel 
}) {
  // Store resolution state for each transaction ID: 'skip' | 'import' | 'overwrite'
  const [resolutions, setResolutions] = useState(() => {
    const initial = {};
    pendingTransactions.forEach(tx => {
      if (tx.importStatus === 'exact') {
        initial[tx.id] = 'skip'; // Default for exact matches is to skip
      } else if (tx.importStatus === 'fuzzy') {
        initial[tx.id] = 'skip'; // Default for fuzzy matches (could be skip or import, we ask them to verify)
      }
    });
    return initial;
  });

  const conflicts = pendingTransactions.filter(tx => tx.importStatus === 'exact' || tx.importStatus === 'fuzzy');
  const cleanTransactions = pendingTransactions.filter(tx => tx.importStatus === 'new');

  const handleResolve = (txId, action) => {
    setResolutions(prev => ({
      ...prev,
      [txId]: action
    }));
  };

  const handleApply = () => {
    // Collect all transactions to add or modify
    const toImport = [];
    const toOverwrite = {};

    pendingTransactions.forEach(tx => {
      const autoCatId = getAutoCategoryId(tx.description, categories);
      if (tx.importStatus === 'new') {
        toImport.push({
          id: tx.id,
          accountId: tx.accountId,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          checkNumber: tx.checkNumber || '',
          reviewed: false,
          splits: [
            {
              id: `split_${Math.random().toString(36).substr(2, 9)}`,
              amount: tx.amount,
              categoryId: autoCatId,
              notes: 'Imported from statement'
            }
          ]
        });
      } else {
        const resolution = resolutions[tx.id];
        if (resolution === 'import') {
          toImport.push({
            id: tx.id,
            accountId: tx.accountId,
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            checkNumber: tx.checkNumber || '',
            reviewed: false,
            splits: [
              {
                id: `split_${Math.random().toString(36).substr(2, 9)}`,
                amount: tx.amount,
                categoryId: autoCatId,
                notes: 'Imported anyway (conflict override)'
              }
            ]
          });
        } else if (resolution === 'overwrite') {
          // Replace matching transaction but keep its ID (overwrite metadata)
          toOverwrite[tx.matchedWith.id] = {
            id: tx.matchedWith.id,
            accountId: tx.accountId,
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            checkNumber: tx.checkNumber || '',
            reviewed: false,
            // Overwriting resets split allocations to match new amount
            splits: [
              {
                id: `split_${Math.random().toString(36).substr(2, 9)}`,
                amount: tx.amount,
                categoryId: autoCatId,
                notes: 'Overwritten from statement'
              }
            ]
          };
        }
      }
    });

    onCompleteImport(toImport, toOverwrite);
  };

  const resolvedCount = Object.keys(resolutions).length;
  const isAllResolved = true; // Since we initialize a default action for all, they are technically pre-resolved

  const getStatusBadge = (status) => {
    if (status === 'exact') return <span className="badge badge-exact">Exact Match</span>;
    if (status === 'fuzzy') return <span className="badge badge-fuzzy">Fuzzy Match</span>;
    return <span className="badge badge-new">New</span>;
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      {/* Wizard Header Info */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem', borderLeft: '4px solid var(--primary)' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>Import Wizard: {account.name}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            We analyzed **{pendingTransactions.length}** transactions from the CSV statement. 
            Found **{cleanTransactions.length}** new transactions and **{conflicts.length}** conflicts.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} className="btn btn-secondary">
            Cancel Import
          </button>
          <button onClick={handleApply} className="btn btn-primary">
            <Check size={16} />
            Apply Imports ({cleanTransactions.length + Object.values(resolutions).filter(r => r !== 'skip').length} items)
          </button>
        </div>
      </div>

      {/* Clean Transactions summary */}
      {cleanTransactions.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.85rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} />
            Auto-Importing {cleanTransactions.length} New Transactions
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            These transactions have no duplicates in the system and will be imported automatically.
          </p>
          <div className="table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {cleanTransactions.map((tx, idx) => (
                  <tr key={idx}>
                    <td>{tx.date}</td>
                    <td>{tx.description}</td>
                    <td className={tx.amount < 0 ? 'amt-outflow' : 'amt-inflow'}>
                      {tx.amount < 0 ? '-' : ''}${Math.abs(tx.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Conflict Resolution Area */}
      {conflicts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)' }}>
            <AlertTriangle size={20} />
            Review Conflicts ({conflicts.length})
          </h3>
          
          {conflicts.map((tx) => {
            const currentResolution = resolutions[tx.id];
            
            return (
              <div key={tx.id} className="card" style={{ border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {getStatusBadge(tx.importStatus)}
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Conflict ID: {tx.id}
                    </span>
                  </div>

                  {/* Resolution Selector Buttons */}
                  <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-input)', padding: '4px', borderRadius: '6px' }}>
                    <button 
                      onClick={() => handleResolve(tx.id, 'skip')} 
                      className="btn btn-sm" 
                      style={{ 
                        backgroundColor: currentResolution === 'skip' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                        color: currentResolution === 'skip' ? 'var(--danger)' : 'var(--text-muted)',
                        border: currentResolution === 'skip' ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid transparent',
                        minHeight: 'auto',
                        padding: '0.35rem 0.65rem'
                      }}
                    >
                      <X size={12} />
                      Skip
                    </button>
                    <button 
                      onClick={() => handleResolve(tx.id, 'import')} 
                      className="btn btn-sm"
                      style={{ 
                        backgroundColor: currentResolution === 'import' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                        color: currentResolution === 'import' ? 'var(--success)' : 'var(--text-muted)',
                        border: currentResolution === 'import' ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid transparent',
                        minHeight: 'auto',
                        padding: '0.35rem 0.65rem'
                      }}
                    >
                      <Copy size={12} />
                      Import Anyway
                    </button>
                    <button 
                      onClick={() => handleResolve(tx.id, 'overwrite')} 
                      className="btn btn-sm"
                      style={{ 
                        backgroundColor: currentResolution === 'overwrite' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        color: currentResolution === 'overwrite' ? 'var(--primary)' : 'var(--text-muted)',
                        border: currentResolution === 'overwrite' ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid transparent',
                        minHeight: 'auto',
                        padding: '0.35rem 0.65rem'
                      }}
                    >
                      <ArrowRight size={12} />
                      Overwrite
                    </button>
                  </div>
                </div>

                {/* Card side-by-side comparison */}
                <div className="wizard-compare-grid">
                  {/* Incoming transaction */}
                  <div className="compare-card incoming">
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: '700', marginBottom: '6px' }}>
                      Incoming Transaction (CSV)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: '600' }}>{tx.date}</span>
                        <span className={tx.amount < 0 ? 'amt-outflow' : 'amt-inflow'}>
                          {tx.amount < 0 ? '-' : ''}${Math.abs(tx.amount).toFixed(2)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.9rem', fontWeight: '500', wordBreak: 'break-all' }}>
                        {tx.description}
                      </div>
                      {tx.checkNumber && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Check Number: #{tx.checkNumber}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Existing transaction */}
                  <div className="compare-card existing">
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '6px' }}>
                      Existing Transaction (Database)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: '600' }}>{tx.matchedWith.date}</span>
                        <span className={tx.matchedWith.amount < 0 ? 'amt-outflow' : 'amt-inflow'}>
                          {tx.matchedWith.amount < 0 ? '-' : ''}${Math.abs(tx.matchedWith.amount).toFixed(2)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                        {tx.matchedWith.description}
                      </div>
                      {tx.matchedWith.checkNumber && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Check Number: #{tx.matchedWith.checkNumber}
                        </div>
                      )}
                      {tx.matchedWith.splits && tx.matchedWith.splits.length > 0 && (
                        <div style={{ fontSize: '0.75rem', padding: '6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                          <strong>Current Splits:</strong>
                          <ul style={{ paddingLeft: '1rem', marginTop: '4px' }}>
                            {tx.matchedWith.splits.map((s, i) => (
                              <li key={i}>
                                ${Math.abs(s.amount).toFixed(2)} &bull; {s.notes || 'No notes'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Resolution Summary Description text */}
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '8px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)' }}>
                  {currentResolution === 'skip' && (
                    <span>🚫 <strong>Skip Action selected</strong>: This transaction will not be imported. The existing database record will be kept unchanged.</span>
                  )}
                  {currentResolution === 'import' && (
                    <span>📥 <strong>Import Anyway selected</strong>: This transaction will be imported as a brand new, separate transaction. You will end up with duplicate records.</span>
                  )}
                  {currentResolution === 'overwrite' && (
                    <span>🔄 <strong>Overwrite selected</strong>: The existing transaction details (date, description, amount) will be updated with the incoming details. All existing split categorizations will be reset to Uncategorized.</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

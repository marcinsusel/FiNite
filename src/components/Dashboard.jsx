import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, DollarSign, Wallet, Calendar, Tag } from 'lucide-react';

export default function Dashboard({ transactions, accounts, categories }) {
  // Extract all unique months (YYYY-MM) from transactions for filtering
  const months = Array.from(
    new Set(transactions.map(t => t.date.substring(0, 7)))
  ).sort((a, b) => b.localeCompare(a)); // Sort latest first

  const [selectedMonth, setSelectedMonth] = useState('all');

  // Filter transactions by selected month
  const filteredTxs = selectedMonth === 'all' 
    ? transactions 
    : transactions.filter(t => t.date.startsWith(selectedMonth));

  // Compute Cash Flow Metrics (based on splits for accurate category breakdown, but overall sums equal transactions)
  let totalInflow = 0;
  let totalOutflow = 0;

  // We aggregate splits to categorize properly
  const categoryAgg = {};
  // Initialize categories in aggregator
  categories.forEach(c => {
    categoryAgg[c.id] = { name: c.name, inflow: 0, outflow: 0 };
  });

  filteredTxs.forEach(tx => {
    tx.splits.forEach(split => {
      const amt = Number(split.amount || 0);
      const catId = split.categoryId || 'cat-uncategorized';
      
      if (!categoryAgg[catId]) {
        categoryAgg[catId] = { name: 'Unknown', inflow: 0, outflow: 0 };
      }

      if (amt > 0) {
        totalInflow += amt;
        categoryAgg[catId].inflow += amt;
      } else {
        totalOutflow += amt;
        categoryAgg[catId].outflow += amt;
      }
    });
  });

  const netCashFlow = totalInflow + totalOutflow; // Note: totalOutflow is negative

  // Aggregate Net Activity by Bank Account
  const accountBalances = accounts.map(acc => {
    const accTxs = filteredTxs.filter(t => t.accountId === acc.id);
    const netActivity = accTxs.reduce((sum, t) => sum + t.amount, 0);
    return {
      ...acc,
      netActivity
    };
  });

  // Prepare Category Spending Chart Data (Outflows only, sorted by highest spending)
  const categorySpending = Object.entries(categoryAgg)
    .map(([id, data]) => ({
      id,
      name: data.name,
      amount: Math.abs(data.outflow)
    }))
    .filter(c => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const totalSpending = categorySpending.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Dashboard Toolbar: Month Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem' }}>Financial Analytics</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Overview of transaction activity and category allocations.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={16} className="text-muted" />
          <select 
            className="input select"
            style={{ width: '160px', padding: '0.45rem 0.65rem' }}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="all">All Time</option>
            {months.map(m => {
              // Format YYYY-MM to Month YYYY
              const date = new Date(m + '-02'); // add day to avoid timezone slip
              const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              return <option key={m} value={m}>{label}</option>;
            })}
          </select>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid-cols-3">
        {/* Total Inflow */}
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>Total Inflows</span>
            <div style={{ padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.08)', color: 'var(--success)' }}>
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div className="stat-val" style={{ color: 'var(--success)' }}>
            ${totalInflow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Deposits & refunds</span>
        </div>

        {/* Total Outflow */}
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>Total Outflows</span>
            <div style={{ padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(220, 38, 38, 0.08)', color: 'var(--danger)' }}>
              <ArrowDownRight size={18} />
            </div>
          </div>
          <div className="stat-val" style={{ color: 'var(--danger)' }}>
            -${Math.abs(totalOutflow).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Expenses & debits</span>
        </div>

        {/* Net Flow */}
        <div className="card stat-card" style={{ borderLeft: `4px solid ${netCashFlow >= 0 ? 'var(--info)' : 'var(--warning)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>Net Cash Flow</span>
            <div style={{ padding: '6px', borderRadius: '50%', backgroundColor: netCashFlow >= 0 ? 'rgba(6, 182, 212, 0.08)' : 'rgba(217, 119, 6, 0.08)', color: netCashFlow >= 0 ? 'var(--info)' : 'var(--warning)' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div className="stat-val" style={{ color: netCashFlow >= 0 ? 'var(--info)' : 'var(--warning)' }}>
            {netCashFlow < 0 ? '-' : ''}${Math.abs(netCashFlow).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Difference (Inflows - Outflows)</span>
        </div>
      </div>

      <div className="grid-cols-2">
        {/* Category Spending Progress Bars */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 className="card-title">
            <Tag size={18} className="text-primary" />
            Spending by Category
          </h3>

          {categorySpending.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, padding: '2rem 0', color: 'var(--text-muted)', gap: '8px' }}>
              <Tag size={32} style={{ opacity: 0.3 }} />
              <span>No expense splits found in this period.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
              {categorySpending.map(cat => {
                const pct = totalSpending > 0 ? (cat.amount / totalSpending) * 100 : 0;
                return (
                  <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: '500' }}>
                      <span>{cat.name}</span>
                      <span>
                        ${cat.amount.toFixed(2)}{' '}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '400' }}>
                          ({pct.toFixed(0)}%)
                        </span>
                      </span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${pct}%`, 
                          height: '100%', 
                          background: 'linear-gradient(to right, var(--primary), var(--info))',
                          borderRadius: '4px'
                        }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Net Activity by Account */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 className="card-title">
            <Wallet size={18} className="text-primary" />
            Account Net Activity
          </h3>
          
          {accountBalances.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, padding: '2rem 0', color: 'var(--text-muted)', gap: '8px' }}>
              <Wallet size={32} style={{ opacity: 0.3 }} />
              <span>No accounts configured.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '0.5rem' }}>
              {accountBalances.map(acc => (
                <div 
                  key={acc.id} 
                  className="compare-card" 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem' }}
                >
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{acc.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Format: {acc.bank}</div>
                  </div>
                  <div 
                    className={acc.netActivity >= 0 ? 'amt-inflow' : 'amt-outflow'} 
                    style={{ fontSize: '1.1rem', fontWeight: '700' }}
                  >
                    {acc.netActivity < 0 ? '-' : ''}${Math.abs(acc.netActivity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

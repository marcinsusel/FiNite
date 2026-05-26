import React, { useState, useEffect } from 'react';
import { 
  PiggyBank, Calculator, Calendar, Edit2, Check, X, RefreshCw, 
  TrendingUp, TrendingDown, AlertCircle, Info, Sparkles, CheckCircle2, ArrowRight
} from 'lucide-react';

export default function BudgetManager({ 
  transactions = [], 
  categories = [], 
  budget = {}, 
  onSaveBudget,
  onNavigate
}) {
  // Extract all unique months (YYYY-MM) from transactions for filtering
  const months = Array.from(
    new Set(transactions.map(t => t.date.substring(0, 7)))
  ).sort((a, b) => b.localeCompare(a)); // Latest first

  // Setup onboarding states
  const [startMonth, setStartMonth] = useState(months[0] || '');
  const [onboardError, setOnboardError] = useState('');

  // Active view states
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const currentCalendarMonth = new Date().toISOString().substring(0, 7);
    if (months.includes(currentCalendarMonth)) {
      return currentCalendarMonth;
    }
    return months.length > 0 ? months[0] : currentCalendarMonth;
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editTargets, setEditTargets] = useState({});
  const [recalcMonth, setRecalcMonth] = useState(months[0] || '');
  const [showRecalcSuccess, setShowRecalcSuccess] = useState(false);
  const [hoveredCatId, setHoveredCatId] = useState(null);

  // Sync editTargets when entering edit mode
  useEffect(() => {
    if (isEditing) {
      const initial = {};
      categories.forEach(cat => {
        if (cat.id !== 'cat-transfer') {
          initial[cat.id] = budget[cat.id] !== undefined ? budget[cat.id] : 0;
        }
      });
      setEditTargets(initial);
    }
  }, [isEditing, budget, categories]);

  // If no budget is set up, show onboarding
  const hasBudget = Object.keys(budget).length > 0;

  // Onboarding: Generate budget based on historical month's category totals
  const handleGenerateBudget = (sourceMonth) => {
    if (!sourceMonth) {
      setOnboardError('Please select a starting month.');
      return;
    }

    const generated = {};
    const sourceTxs = transactions.filter(t => t.date.startsWith(sourceMonth));

    categories.forEach(cat => {
      if (cat.id === 'cat-transfer') return; // Exclude internal transfer
      
      let sum = 0;
      sourceTxs.forEach(tx => {
        tx.splits.forEach(split => {
          if (split.categoryId === cat.id) {
            const amt = Number(split.amount || 0);
            if (cat.id === 'cat-salary') {
              if (amt > 0) sum += amt;
            } else {
              if (amt < 0) sum += Math.abs(amt);
            }
          }
        });
      });

      generated[cat.id] = Number(sum.toFixed(2));
    });

    onSaveBudget(generated);
    setOnboardError('');
  };

  // Onboarding: Start with a blank ($0) budget
  const handleStartBlank = () => {
    const generated = {};
    categories.forEach(cat => {
      if (cat.id !== 'cat-transfer') {
        generated[cat.id] = 0;
      }
    });
    onSaveBudget(generated);
  };

  // Calculate actual spending/income for the selected month
  const actuals = {};
  categories.forEach(cat => {
    actuals[cat.id] = 0;
  });

  const monthTransactions = transactions.filter(t => t.date.startsWith(selectedMonth));
  monthTransactions.forEach(tx => {
    tx.splits.forEach(split => {
      const amt = Number(split.amount || 0);
      const catId = split.categoryId || 'cat-uncategorized';
      
      if (catId === 'cat-salary') {
        if (amt > 0) actuals[catId] += amt;
      } else {
        if (amt < 0) actuals[catId] += Math.abs(amt);
      }
    });
  });

  // Calculate totals for summary cards (excluding cat-transfer and cat-salary for spending)
  let totalBudgetedExpenses = 0;
  let totalSpentExpenses = 0;

  categories.forEach(cat => {
    if (cat.id !== 'cat-transfer' && cat.id !== 'cat-salary') {
      totalBudgetedExpenses += budget[cat.id] || 0;
      totalSpentExpenses += actuals[cat.id] || 0;
    }
  });

  const remainingBudget = totalBudgetedExpenses - totalSpentExpenses;
  const expenseProgressPercent = totalBudgetedExpenses > 0 
    ? (totalSpentExpenses / totalBudgetedExpenses) * 100 
    : 0;

  // Income summary card
  const budgetedIncome = budget['cat-salary'] || 0;
  const actualIncome = actuals['cat-salary'] || 0;

  // Handle saving edited targets
  const handleSaveEdited = () => {
    const cleanedTargets = {};
    Object.entries(editTargets).forEach(([catId, val]) => {
      const num = Number(val);
      cleanedTargets[catId] = isNaN(num) || num < 0 ? 0 : Number(num.toFixed(2));
    });
    onSaveBudget(cleanedTargets);
    setIsEditing(false);
  };

  // Handle target recalculation in settings
  const handleRecalculate = () => {
    if (!recalcMonth) return;
    const generated = {};
    const sourceTxs = transactions.filter(t => t.date.startsWith(recalcMonth));

    categories.forEach(cat => {
      if (cat.id === 'cat-transfer') return;
      
      let sum = 0;
      sourceTxs.forEach(tx => {
        tx.splits.forEach(split => {
          if (split.categoryId === cat.id) {
            const amt = Number(split.amount || 0);
            if (cat.id === 'cat-salary') {
              if (amt > 0) sum += amt;
            } else {
              if (amt < 0) sum += Math.abs(amt);
            }
          }
        });
      });

      generated[cat.id] = Number(sum.toFixed(2));
    });

    onSaveBudget(generated);
    setShowRecalcSuccess(true);
    setTimeout(() => {
      setShowRecalcSuccess(false);
    }, 3000);
  };

  // Fetch matching transactions for a category in the selected month sorted from high to low
  const getCategoryTransactions = (catId, isIncome) => {
    const list = [];
    monthTransactions.forEach(tx => {
      tx.splits.forEach(split => {
        if (split.categoryId === catId) {
          const amt = Number(split.amount || 0);
          if (isIncome) {
            if (amt > 0) {
              list.push({
                description: tx.description,
                date: tx.date,
                notes: split.notes || '',
                amount: amt
              });
            }
          } else {
            if (amt < 0) {
              list.push({
                description: tx.description,
                date: tx.date,
                notes: split.notes || '',
                amount: Math.abs(amt)
              });
            }
          }
        }
      });
    });

    // Sort descending by amount
    return list.sort((a, b) => b.amount - a.amount);
  };

  // Perform cross-navigation filters setups and redirect
  const handleNavigateToLog = (catId) => {
    if (!selectedMonth) return;
    const year = parseInt(selectedMonth.split('-')[0]);
    const month = parseInt(selectedMonth.split('-')[1]);
    const lastDay = new Date(year, month, 0).getDate();
    const lastDayStr = String(lastDay).padStart(2, '0');
    const startDateStr = `${selectedMonth}-01`;
    const endDateStr = `${selectedMonth}-${lastDayStr}`;

    // Write parameters to localStorage
    localStorage.setItem('finite_filter_category', catId);
    localStorage.setItem('finite_filter_start_date', startDateStr);
    localStorage.setItem('finite_filter_end_date', endDateStr);
    localStorage.setItem('finite_filter_account', 'all');
    localStorage.setItem('finite_filter_reviewed', 'all');
    localStorage.setItem('finite_filter_search', '');

    if (onNavigate) {
      onNavigate('transactions');
    }
  };

  // Onboarding render
  if (!hasBudget) {
    return (
      <div className="fade-in" style={{ maxWidth: '600px', margin: '2rem auto', width: '100%' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)' }}>
              <PiggyBank size={32} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem' }}>Create Your Budget</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Set up monthly limits to monitor and control your spending habits.</p>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>Option A: Auto-generate starting budget</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              We will calculate category spending totals from a historical month (excluding transfers) and use them as your baseline budget targets.
            </p>

            {months.length > 0 ? (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ marginBottom: 0, flexGrow: 1 }}>
                  <label htmlFor="startMonthSelect">Choose Historical Starting Month</label>
                  <select 
                    id="startMonthSelect"
                    className="input select"
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                  >
                    {months.map(m => {
                      const date = new Date(m + '-02');
                      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                      return <option key={m} value={m}>{label}</option>;
                    })}
                  </select>
                </div>
                <button 
                  onClick={() => handleGenerateBudget(startMonth)}
                  className="btn btn-primary"
                  style={{ height: '42px' }}
                >
                  <Sparkles size={16} />
                  Generate Baseline
                </button>
              </div>
            ) : (
              <div style={{ padding: '1rem', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.85rem' }}>
                No imported transaction history found. Please upload bank statement CSVs first to enable auto-generation.
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>Option B: Start fresh</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Create an empty budget. All category targets will be set to $0, and you can edit them manually.
            </p>
            <button 
              onClick={handleStartBlank}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              <Calculator size={16} />
              Start with Empty Budget ($0)
            </button>
          </div>

          {onboardError && (
            <div style={{ display: 'flex', gap: '8px', padding: '10px', backgroundColor: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--danger)', marginTop: '0.5rem' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{onboardError}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active view render
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem' }}>Budget Tracking Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Monitor and adjust your category spending goals against actual allocations.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} className="text-muted" />
            <select 
              className="input select"
              style={{ width: '165px', padding: '0.45rem 0.65rem' }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {months.map(m => {
                const date = new Date(m + '-02');
                const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                return <option key={m} value={m}>{label}</option>;
              })}
            </select>
          </div>

          {!isEditing ? (
            <button 
              onClick={() => setIsEditing(true)} 
              className="btn btn-primary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
            >
              <Edit2 size={14} />
              Edit Budget Goals
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                onClick={handleSaveEdited} 
                className="btn btn-primary"
                style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', backgroundColor: 'var(--success)', backgroundImage: 'none' }}
              >
                <Check size={14} />
                Save Goals
              </button>
              <button 
                onClick={() => setIsEditing(false)} 
                className="btn btn-secondary"
                style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
              >
                <X size={14} />
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards Row */}
      <div className="grid-cols-3">
        {/* Total Expense Budgeted */}
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>Total Expense Limit</span>
            <div style={{ padding: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)' }}>
              <TrendingDown size={18} />
            </div>
          </div>
          <div className="stat-val">
            ${totalBudgetedExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Spent: ${totalSpentExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({expenseProgressPercent.toFixed(0)}%)
          </span>
        </div>

        {/* Remaining Budget Balance */}
        <div className="card stat-card" style={{ borderLeft: `4px solid ${remainingBudget >= 0 ? 'var(--success)' : 'var(--danger)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>Remaining Budget Balance</span>
            <div style={{ 
              padding: '6px', 
              borderRadius: '50%', 
              backgroundColor: remainingBudget >= 0 ? 'rgba(34, 197, 94, 0.08)' : 'rgba(220, 38, 38, 0.08)', 
              color: remainingBudget >= 0 ? 'var(--success)' : 'var(--danger)' 
            }}>
              <PiggyBank size={18} />
            </div>
          </div>
          <div className="stat-val" style={{ color: remainingBudget >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {remainingBudget < 0 ? '-' : ''}${Math.abs(remainingBudget).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {remainingBudget >= 0 ? 'Safe margin remaining' : '⚠️ Exceeded expense limits'}
          </span>
        </div>

        {/* Salary / Inflows Tracking */}
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--info)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>Income Baseline Goal</span>
            <div style={{ padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(6, 182, 212, 0.08)', color: 'var(--info)' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="stat-val" style={{ color: 'var(--info)' }}>
            ${budgetedIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Earned: ${actualIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({budgetedIncome > 0 ? ((actualIncome / budgetedIncome) * 100).toFixed(0) : 0}%)
          </span>
        </div>
      </div>

      {/* Main Budget layout grid */}
      <div className="grid-cols-2" style={{ alignItems: 'start' }}>
        
        {/* Categories budget list card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 className="card-title" style={{ margin: 0 }}>
            <Calculator size={18} className="text-primary" />
            Budget Target Breakdowns
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {categories
              .filter(cat => cat.id !== 'cat-transfer') // Exclude internal transfer
              .map(cat => {
                const isIncome = cat.id === 'cat-salary';
                const actualVal = actuals[cat.id] || 0;
                
                // Read from editTargets in editing mode, else budget targets
                const targetLimit = isEditing 
                  ? (editTargets[cat.id] !== undefined ? editTargets[cat.id] : '') 
                  : (budget[cat.id] || 0);

                const currentLimit = budget[cat.id] || 0;
                
                // Calculate progress percentages
                const percent = currentLimit > 0 ? (actualVal / currentLimit) * 100 : 0;
                const remaining = currentLimit - actualVal;

                // Dynamic progress bar styling
                let barGradient = 'linear-gradient(to right, var(--primary), var(--info))';
                let alertColor = 'var(--text-muted)';
                let isWarning = false;
                let isCritical = false;

                if (isIncome) {
                  if (actualVal >= currentLimit && currentLimit > 0) {
                    barGradient = 'linear-gradient(to right, #10B981, #059669)'; // emerald
                    alertColor = 'var(--success)';
                  } else {
                    barGradient = 'linear-gradient(to right, #06B6D4, #3B82F6)'; // cyan-blue
                    alertColor = 'var(--info)';
                  }
                } else {
                  if (percent > 100) {
                    barGradient = 'linear-gradient(to right, #EF4444, #EC4899)'; // red-pink
                    alertColor = 'var(--danger)';
                    isCritical = true;
                  } else if (percent > 85) {
                    barGradient = 'linear-gradient(to right, #F59E0B, #D97706)'; // amber-orange
                    alertColor = 'var(--warning)';
                    isWarning = true;
                  } else {
                    barGradient = 'linear-gradient(to right, var(--primary), var(--info))';
                    alertColor = 'var(--text-muted)';
                  }
                }

                const matchingTransactions = getCategoryTransactions(cat.id, isIncome);

                return (
                  <div 
                    key={cat.id} 
                    onMouseEnter={() => !isEditing && setHoveredCatId(cat.id)}
                    onMouseLeave={() => setHoveredCatId(null)}
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px', 
                      padding: '8px 12px', 
                      margin: '0 -12px',
                      borderRadius: 'var(--radius-sm)',
                      borderBottom: '1px solid rgba(255,255,255,0.02)',
                      position: 'relative',
                      backgroundColor: hoveredCatId === cat.id ? 'rgba(128,128,128,0.06)' : 'transparent',
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    {/* Display absolute positioned popover if hovered */}
                    {hoveredCatId === cat.id && (
                      <div 
                        style={{
                          position: 'absolute',
                          bottom: '105%',
                          left: '0',
                          right: '0',
                          zIndex: 50,
                          backgroundColor: 'var(--bg-app)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1rem',
                          boxShadow: 'var(--shadow-lg)',
                          backdropFilter: 'var(--glass-blur)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          cursor: 'default'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Popover Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--primary)' }}>
                            {cat.name} Activity
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {new Date(selectedMonth + '-02').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          </span>
                        </div>

                        {/* Transaction splits list */}
                        <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                          {matchingTransactions.length === 0 ? (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
                              No transactions in this period.
                            </span>
                          ) : (
                            matchingTransactions.map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', padding: '4px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '70%' }}>
                                  <span style={{ fontWeight: '600', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.description}>
                                    {item.description}
                                  </span>
                                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                    {item.date} {item.notes ? `• ${item.notes}` : ''}
                                  </span>
                                </div>
                                <span className={isIncome ? 'amt-inflow' : 'amt-outflow'} style={{ fontWeight: '700' }}>
                                  {isIncome ? '' : '-'}${item.amount.toFixed(2)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Go to transactions log CTA */}
                        <button 
                          onClick={() => handleNavigateToLog(cat.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ 
                            width: '100%', 
                            fontSize: '0.75rem', 
                            padding: '6px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '6px',
                            backgroundColor: 'var(--primary-glow)',
                            borderColor: 'rgba(99, 102, 241, 0.2)',
                            color: 'var(--primary)'
                          }}
                        >
                          <span>Analyze in Log</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontWeight: '600', fontSize: '0.92rem' }}>
                        {cat.name}
                        {isIncome && <span style={{ marginLeft: '6px', fontSize: '0.7rem', verticalAlign: 'middle' }} className="badge badge-new">Income</span>}
                      </span>

                      {/* Display / Input Targets */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {isIncome ? 'Earned' : 'Spent'}: <strong>${actualVal.toFixed(2)}</strong> of
                        </span>
                        {isEditing ? (
                          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                            <span style={{ position: 'absolute', left: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>$</span>
                            <input 
                              type="number"
                              className="input"
                              style={{ width: '90px', padding: '4px 6px 4px 18px', fontSize: '0.85rem', height: '28px' }}
                              value={targetLimit}
                              min="0"
                              step="0.01"
                              onChange={(e) => setEditTargets(prev => ({
                                ...prev,
                                [cat.id]: e.target.value
                              }))}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        ) : (
                          <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                            ${currentLimit.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar Frame */}
                    <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${Math.min(percent, 100)}%`, 
                          height: '100%', 
                          background: barGradient,
                          borderRadius: '4px',
                          transition: 'width 0.4s ease-out'
                        }} 
                      />
                    </div>

                    {/* Meta indicator subtexts */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: alertColor }}>
                      <span>
                        {isIncome ? (
                          actualVal >= currentLimit ? 'Target achieved!' : `${(percent).toFixed(0)}% of goal reached`
                        ) : (
                          `${(percent).toFixed(0)}% allocated`
                        )}
                      </span>
                      <span>
                        {isIncome ? (
                          remaining > 0 
                            ? `$${remaining.toFixed(2)} remaining to hit goal` 
                            : `+$${Math.abs(remaining).toFixed(2)} over budget goal`
                        ) : (
                          remaining >= 0 
                            ? `$${remaining.toFixed(2)} remaining` 
                            : `🚨 Over budget by $${Math.abs(remaining).toFixed(2)}`
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Operations Settings and Recalculations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Quick Settings Panel */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 className="card-title" style={{ margin: 0 }}>
              <RefreshCw size={18} className="text-primary" />
              Recalculate Baseline Targets
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.4' }}>
              Want to start over or re-initialize? Choose another historical month to extract category spending/income baselines. This will replace all your current budget targets.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="recalcMonthSelect">Choose Target Starting Month</label>
                <select 
                  id="recalcMonthSelect"
                  className="input select"
                  value={recalcMonth}
                  onChange={(e) => setRecalcMonth(e.target.value)}
                >
                  {months.map(m => {
                    const date = new Date(m + '-02');
                    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                    return <option key={m} value={m}>{label}</option>;
                  })}
                </select>
              </div>

              <button 
                onClick={handleRecalculate}
                className="btn btn-secondary"
                style={{ width: '100%', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}
                disabled={!recalcMonth}
              >
                <RefreshCw size={14} />
                Re-initialize Targets
              </button>
            </div>

            {showRecalcSuccess && (
              <div style={{ display: 'flex', gap: '8px', padding: '10px', backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--success)' }}>
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span>Budget goals successfully re-calculated and saved!</span>
              </div>
            )}
          </div>

          {/* Quick Tips Info Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--glass-bg)' }}>
            <h3 className="card-title" style={{ margin: 0, fontSize: '1rem' }}>
              <Info size={16} className="text-info" />
              Budgeting Best Practices
            </h3>
            <ul style={{ paddingLeft: '1.15rem', color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: '1.4' }}>
              <li><strong>Split Transactions:</strong> If a single charge spans multiple categories (e.g. Target having both Groceries and Housing items), use the <em>Splits</em> feature in the Transaction Log to allocate them. The budget monitors splits, not the raw charge totals.</li>
              <li><strong>Drive Sync:</strong> Every time you update a budget baseline or change amounts, it auto-caches locally and syncs to your linked Google Drive file within seconds.</li>
              <li><strong>Exclusions:</strong> Internal Transfers are excluded because they do not represent net changes in your net worth.</li>
            </ul>
          </div>

        </div>

      </div>

    </div>
  );
}

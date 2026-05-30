import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Wallet, Calendar, Plus, Trash2, Copy, Edit2, Check, 
  Sparkles, Info, Sliders, ChevronDown, ChevronRight, X, BarChart3, CheckCircle2, AlertCircle 
} from 'lucide-react';

const getIncomeAmountForMonth = (income, month) => {
  if (!income) return 0;
  const baseline = Number(income.amount || 0);
  if (!income.changes || income.changes.length === 0) return baseline;
  
  const applicableChanges = income.changes.filter(c => c.date <= month);
  if (applicableChanges.length === 0) return baseline;
  
  applicableChanges.sort((a, b) => b.date.localeCompare(a.date));
  return Number(applicableChanges[0].amount ?? baseline);
};

const getExpenseAmountForMonth = (exp, month) => {
  if (!exp) return 0;
  const baseline = Number(exp.amount || 0);
  if (!exp.changes || exp.changes.length === 0) return baseline;
  
  const applicableChanges = exp.changes.filter(c => c.date <= month);
  if (applicableChanges.length === 0) return baseline;
  
  applicableChanges.sort((a, b) => b.date.localeCompare(a.date));
  return Number(applicableChanges[0].amount ?? baseline);
};

export default function Planning({ 
  transactions = [], 
  accounts = [], 
  categories = [], 
  scenarios = [], 
  onSaveScenarios 
}) {
  const [activeScenarioId, setActiveScenarioId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Creation States
  const [newScenarioName, setNewScenarioName] = useState('');
  const [newScenarioEndDate, setNewScenarioEndDate] = useState(() => {
    // Default to 3 years from now
    const d = new Date();
    d.setFullYear(d.getFullYear() + 3);
    return d.toISOString().substring(0, 7); // YYYY-MM
  });

  // UI state variables
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [editingFlows, setEditingFlows] = useState(false);
  const [expandedSection, setExpandedSection] = useState('projection'); // 'projection' | 'details'
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameText, setRenameText] = useState('');
  
  // Local state for add-override fields per account
  const [addOverrideDate, setAddOverrideDate] = useState({});
  const [addOverrideVal, setAddOverrideVal] = useState({});

  // Future cash flow change states
  const [addIncomeChangeDate, setAddIncomeChangeDate] = useState('');
  const [addIncomeChangeVal, setAddIncomeChangeVal] = useState('');
  const [addExpenseChangeDate, setAddExpenseChangeDate] = useState({});
  const [addExpenseChangeVal, setAddExpenseChangeVal] = useState({});

  // 1. Calculate current system actual balances for all accounts
  const currentBalances = {};
  const todayStr = new Date().toISOString().split('T')[0];
  accounts.forEach(acc => {
    if (acc.type === 'summary' || acc.type === 'loan') {
      const sorted = [...(acc.balances || [])].sort((a, b) => b.date.localeCompare(a.date));
      const latest = sorted.find(entry => entry.date <= todayStr);
      currentBalances[acc.id] = latest ? latest.balance : (sorted.length > 0 ? sorted[sorted.length - 1].balance : 0);
    } else {
      currentBalances[acc.id] = transactions
        .filter(t => t.accountId === acc.id)
        .reduce((sum, t) => sum + t.amount, 0);
    }
  });

  // Find the active scenario
  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || scenarios[0];

  // Sync active scenario select box
  useEffect(() => {
    if (scenarios.length > 0 && !activeScenarioId) {
      setActiveScenarioId(scenarios[0].id);
    }
  }, [scenarios, activeScenarioId]);

  // Seed default scenario options from last month's actual data
  const computeLastMonthTotals = () => {
    const months = Array.from(
      new Set(transactions.map(t => t.date.substring(0, 7)))
    ).filter(Boolean).sort((a, b) => b.localeCompare(a));

    if (months.length === 0) return { income: 0, expenses: [] };

    const lastMonth = months[0];
    let income = 0;
    const expenseMap = {};

    transactions
      .filter(t => t.date && t.date.startsWith(lastMonth))
      .forEach(t => {
        t.splits.forEach(split => {
          const amt = Number(split.amount || 0);
          const catId = split.categoryId || 'cat-uncategorized';
          if (catId === 'cat-transfer') return; // Exclude transfers

          if (amt > 0) {
            income += amt;
          } else {
            expenseMap[catId] = (expenseMap[catId] || 0) + Math.abs(amt);
          }
        });
      });

    const expenses = Object.entries(expenseMap).map(([categoryId, amount]) => {
      const cat = categories.find(c => c.id === categoryId);
      return {
        categoryId,
        amount: Number(amount.toFixed(2)),
        active: true,
        accountId: accounts.filter(a => a.type !== 'summary' && a.type !== 'loan')[0]?.id || ''
      };
    });

    return {
      income: Number(income.toFixed(2)),
      expenses
    };
  };

  // Handle Scenario Creation
  const handleCreateScenario = (e) => {
    e.preventDefault();
    if (!newScenarioName.trim()) return;

    const baselines = computeLastMonthTotals();
    const activeAccounts = accounts.filter(a => a.type !== 'summary' && a.type !== 'loan');
    const primaryAccount = activeAccounts[0]?.id || '';

    const newScenario = {
      id: `scen_${Date.now()}`,
      name: newScenarioName,
      endDate: newScenarioEndDate,
      accountAssumptions: {},
      income: {
        amount: baselines.income,
        accountId: primaryAccount,
        active: true
      },
      expenses: baselines.expenses
    };

    // Initialize blank assumptions for all accounts
    accounts.forEach(acc => {
      newScenario.accountAssumptions[acc.id] = {
        yearlyInterestRate: 0,
        overrides: []
      };
    });

    const updated = [...scenarios, newScenario];
    onSaveScenarios(updated);
    setActiveScenarioId(newScenario.id);
    setIsCreating(false);
    setNewScenarioName('');
  };

  // Handle Scenario Deletion
  const handleDeleteScenario = (id) => {
    if (!window.confirm('Are you sure you want to delete this scenario? This action cannot be undone.')) return;
    const updated = scenarios.filter(s => s.id !== id);
    onSaveScenarios(updated);
    if (updated.length > 0) {
      setActiveScenarioId(updated[0].id);
    } else {
      setActiveScenarioId('');
    }
  };

  // Handle Scenario Duplication
  const handleDuplicateScenario = (scenarioToCopy) => {
    if (!scenarioToCopy) return;
    
    const duplicatedScenario = {
      ...scenarioToCopy,
      id: `scen_${Date.now()}`,
      name: `${scenarioToCopy.name} (Copy)`,
      accountAssumptions: JSON.parse(JSON.stringify(scenarioToCopy.accountAssumptions || {})),
      income: scenarioToCopy.income ? { ...scenarioToCopy.income } : undefined,
      expenses: scenarioToCopy.expenses ? scenarioToCopy.expenses.map(e => ({ ...e })) : []
    };

    const updated = [...scenarios, duplicatedScenario];
    onSaveScenarios(updated);
    setActiveScenarioId(duplicatedScenario.id);
  };

  // Handle Scenario Renaming
  const handleSaveRename = () => {
    if (!renameText.trim()) return;
    updateActiveScenario(s => ({
      ...s,
      name: renameText.trim()
    }));
    setIsRenaming(false);
  };

  // Update Scenario Property helper
  const updateActiveScenario = (updater) => {
    const updated = scenarios.map(s => {
      if (s.id === activeScenario.id) {
        return updater(s);
      }
      return s;
    });
    onSaveScenarios(updated);
  };

  // Interest rate change handler
  const handleInterestRateChange = (accountId, val) => {
    const rate = parseFloat(val) || 0;
    updateActiveScenario(s => ({
      ...s,
      accountAssumptions: {
        ...s.accountAssumptions,
        [accountId]: {
          ...(s.accountAssumptions[accountId] || { overrides: [] }),
          yearlyInterestRate: rate
        }
      }
    }));
  };

  // Backup manual account change handler
  const handleBackupAccountChange = (accountId, backupId) => {
    updateActiveScenario(s => ({
      ...s,
      accountAssumptions: {
        ...s.accountAssumptions,
        [accountId]: {
          ...(s.accountAssumptions[accountId] || { yearlyInterestRate: 0, overrides: [] }),
          backupAccountId: backupId || ''
        }
      }
    }));
  };

  // Add Manual Balance Override
  const handleAddOverride = (accountId) => {
    const date = addOverrideDate[accountId];
    const val = addOverrideVal[accountId];
    if (!date || val === undefined || val === '') return;

    const balance = parseFloat(val);
    const currentAss = activeScenario.accountAssumptions[accountId] || { yearlyInterestRate: 0, overrides: [] };
    
    // Check if date override already exists, filter it out to prevent duplicates
    const cleanOverrides = (currentAss.overrides || []).filter(o => o.date !== date);
    const newOverride = {
      id: `over_${Date.now()}`,
      date,
      balance
    };

    const sortedOverrides = [...cleanOverrides, newOverride].sort((a, b) => a.date.localeCompare(b.date));

    updateActiveScenario(s => ({
      ...s,
      accountAssumptions: {
        ...s.accountAssumptions,
        [accountId]: {
          ...currentAss,
          overrides: sortedOverrides
        }
      }
    }));

    // Reset local inputs
    setAddOverrideDate(prev => ({ ...prev, [accountId]: '' }));
    setAddOverrideVal(prev => ({ ...prev, [accountId]: '' }));
  };

  // Delete Manual Balance Override
  const handleDeleteOverride = (accountId, overrideId) => {
    const currentAss = activeScenario.accountAssumptions[accountId];
    if (!currentAss) return;

    const updatedOverrides = currentAss.overrides.filter(o => o.id !== overrideId);
    updateActiveScenario(s => ({
      ...s,
      accountAssumptions: {
        ...s.accountAssumptions,
        [accountId]: {
          ...currentAss,
          overrides: updatedOverrides
        }
      }
    }));
  };

  // Handle Scenario Recurring Cash Flow Changes (Future Date Adjustments)
  const handleAddIncomeChange = () => {
    if (!addIncomeChangeDate || addIncomeChangeVal === '') return;
    const amt = parseFloat(addIncomeChangeVal) || 0;
    const currentChanges = activeScenario.income?.changes || [];
    
    const cleanChanges = currentChanges.filter(c => c.date !== addIncomeChangeDate);
    const newChange = {
      id: `ch_${Date.now()}`,
      date: addIncomeChangeDate,
      amount: amt
    };

    const sortedChanges = [...cleanChanges, newChange].sort((a, b) => a.date.localeCompare(b.date));

    updateActiveScenario(s => ({
      ...s,
      income: {
        ...(s.income || { amount: 0, accountId: '', active: true }),
        changes: sortedChanges
      }
    }));

    setAddIncomeChangeDate('');
    setAddIncomeChangeVal('');
  };

  const handleDeleteIncomeChange = (changeId) => {
    const currentChanges = activeScenario.income?.changes || [];
    const updatedChanges = currentChanges.filter(c => c.id !== changeId);
    
    updateActiveScenario(s => ({
      ...s,
      income: {
        ...(s.income || { amount: 0, accountId: '', active: true }),
        changes: updatedChanges
      }
    }));
  };

  const handleAddExpenseChange = (categoryId) => {
    const date = addExpenseChangeDate[categoryId];
    const val = addExpenseChangeVal[categoryId];
    if (!date || val === undefined || val === '') return;
    const amt = parseFloat(val) || 0;

    const expenseIdx = activeScenario.expenses.findIndex(e => e.categoryId === categoryId);
    if (expenseIdx === -1) return;

    const targetExp = activeScenario.expenses[expenseIdx];
    const currentChanges = targetExp.changes || [];
    
    const cleanChanges = currentChanges.filter(c => c.date !== date);
    const newChange = {
      id: `ch_${Date.now()}`,
      date,
      amount: amt
    };

    const sortedChanges = [...cleanChanges, newChange].sort((a, b) => a.date.localeCompare(b.date));

    const updatedExpenses = [...activeScenario.expenses];
    updatedExpenses[expenseIdx] = {
      ...targetExp,
      changes: sortedChanges
    };

    updateActiveScenario(s => ({
      ...s,
      expenses: updatedExpenses
    }));

    setAddExpenseChangeDate(prev => ({ ...prev, [categoryId]: '' }));
    setAddExpenseChangeVal(prev => ({ ...prev, [categoryId]: '' }));
  };

  const handleDeleteExpenseChange = (categoryId, changeId) => {
    const expenseIdx = activeScenario.expenses.findIndex(e => e.categoryId === categoryId);
    if (expenseIdx === -1) return;

    const targetExp = activeScenario.expenses[expenseIdx];
    const updatedChanges = (targetExp.changes || []).filter(c => c.id !== changeId);

    const updatedExpenses = [...activeScenario.expenses];
    updatedExpenses[expenseIdx] = {
      ...targetExp,
      changes: updatedChanges
    };

    updateActiveScenario(s => ({
      ...s,
      expenses: updatedExpenses
    }));
  };

  // --- Projection Simulation Engine ---
  const runSimulation = () => {
    if (!activeScenario) return { months: [], monthlyHistory: [], yearlyHistory: [] };

    const startMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
    const endMonthStr = activeScenario.endDate;
    
    // Generate projection timeline (YYYY-MM)
    const projectionMonths = [];
    let [sYear, sMonth] = startMonthStr.split('-').map(Number);
    const [eYear, eMonth] = endMonthStr.split('-').map(Number);

    let curYear = sYear;
    let curMonth = sMonth; // include the current month as month 0 (starting point)

    while (curYear < eYear || (curYear === eYear && curMonth <= eMonth)) {
      const mm = String(curMonth).padStart(2, '0');
      projectionMonths.push(`${curYear}-${mm}`);
      curMonth++;
      if (curMonth > 12) {
        curMonth = 1;
        curYear++;
      }
    }

    if (projectionMonths.length === 0) return { months: [], monthlyHistory: [], yearlyHistory: [] };

    // Initial state: current actual balances
    let balances = { ...currentBalances };
    const monthlyHistory = [];
    const loanDiverged = {};
    accounts.forEach(acc => {
      if (acc.type === 'loan') {
        loanDiverged[acc.id] = false;
      }
    });

    // Simulate month-by-month
    projectionMonths.forEach((month, index) => {
      const isStartMonth = index === 0;

      if (!isStartMonth) {
        // Run compounding & flows for subsequent months
        const newBalances = {};
        
        accounts.forEach(acc => {
          let bal = balances[acc.id] || 0;
          const assumptions = activeScenario.accountAssumptions[acc.id] || { yearlyInterestRate: 0, overrides: [] };

          if (acc.type === 'loan') {
            const monthOverride = (assumptions.overrides || []).find(o => o.date === month);
            if (monthOverride) {
              bal = monthOverride.balance;
              loanDiverged[acc.id] = true;
            } else if (loanDiverged[acc.id]) {
              // Custom amortization paydown regime from overridden balance
              const prevBal = balances[acc.id] || 0;
              if (prevBal === 0) {
                bal = 0;
              } else {
                const P = Math.abs(prevBal);
                const r = (acc.apr || 0) / 100 / 12;
                const M = acc.monthlyPayment || 0;
                let nextP = P * (1 + r) - M;
                if (nextP < 0) nextP = 0;
                bal = -Number(nextP.toFixed(2));
              }
            } else {
              // Read pre-populated amortization schedule
              const sorted = [...(acc.balances || [])].sort((a, b) => b.date.localeCompare(a.date));
              const latest = sorted.find(entry => entry.date.substring(0, 7) <= month);
              bal = latest ? latest.balance : (sorted.length > 0 ? sorted[sorted.length - 1].balance : 0);
            }
          } else {
            // A. Compound Interest
            const monthlyRate = (assumptions.yearlyInterestRate || 0) / 100 / 12;
            const interest = bal * monthlyRate;
            bal += interest;

            // B. Add recurring monthly income if mapped to this account
            if (activeScenario.income?.active && activeScenario.income?.accountId === acc.id) {
              const currentIncomeAmt = getIncomeAmountForMonth(activeScenario.income, month);
              bal += currentIncomeAmt;
            }

            // C. Subtract recurring monthly expenses if mapped to this account
            (activeScenario.expenses || []).forEach(exp => {
              if (exp.active && exp.accountId === acc.id) {
                const currentExpenseAmt = getExpenseAmountForMonth(exp, month);
                bal -= currentExpenseAmt; // expense reduces balance
              }
            });
          }

          // D. Apply manual overrides if matching month (handled for loans above)
          if (acc.type !== 'loan') {
            const monthOverride = (assumptions.overrides || []).find(o => o.date === month);
            if (monthOverride) {
              bal = monthOverride.balance;
            }
          }

          newBalances[acc.id] = Number(bal.toFixed(2));
        });

        balances = newBalances;
      } else {
        // In the starting month, apply overrides directly if any are set for the current month
        accounts.forEach(acc => {
          const assumptions = activeScenario.accountAssumptions[acc.id] || { yearlyInterestRate: 0, overrides: [] };
          const monthOverride = (assumptions.overrides || []).find(o => o.date === month);
          if (monthOverride) {
            balances[acc.id] = monthOverride.balance;
            if (acc.type === 'loan') {
              loanDiverged[acc.id] = true;
            }
          }
        });
      }

      // Apply Overdraft/Backup Sweep Protection
      let swept = true;
      let iterations = 0;
      while (swept && iterations < 10) {
        swept = false;
        iterations++;
        accounts.forEach(acc => {
          const assumptions = activeScenario.accountAssumptions[acc.id] || {};
          const val = balances[acc.id] || 0;
          if (val < 0 && assumptions.backupAccountId) {
            const backupId = assumptions.backupAccountId;
            if (balances[backupId] !== undefined) {
              const deficiency = Math.abs(val);
              balances[backupId] = Number(((balances[backupId] || 0) - deficiency).toFixed(2));
              balances[acc.id] = 0;
              swept = true;
            }
          }
        });
      }

      // Compute Net Worth
      let assets = 0;
      let liabilities = 0;
      accounts.forEach(acc => {
        const bal = balances[acc.id] || 0;
        if (bal >= 0) {
          assets += bal;
        } else {
          liabilities += Math.abs(bal);
        }
      });

      const netWorth = assets - liabilities;

      // Compute Net Cash Flow for the month
      let monthlyIncomeTotal = 0;
      let monthlyExpenseTotal = 0;
      if (activeScenario.income?.active) {
        monthlyIncomeTotal += getIncomeAmountForMonth(activeScenario.income, month);
      }
      (activeScenario.expenses || []).forEach(exp => {
        if (exp.active) {
          monthlyExpenseTotal += getExpenseAmountForMonth(exp, month);
        }
      });
      const cashFlow = monthlyIncomeTotal - monthlyExpenseTotal;

      // Compute Net Worth Change from previous month
      const prevPt = monthlyHistory[monthlyHistory.length - 1];
      const netWorthChange = prevPt ? (netWorth - prevPt.netWorth) : 0;

      monthlyHistory.push({
        month,
        balances: { ...balances },
        assets,
        liabilities,
        netWorth,
        cashFlow,
        netWorthChange
      });
    });

    // Compute YoY / Yearly summary
    const yearlyHistory = [];
    const yearGroups = {};

    monthlyHistory.forEach(pt => {
      const year = pt.month.split('-')[0];
      if (!yearGroups[year]) {
        yearGroups[year] = [];
      }
      yearGroups[year].push(pt);
    });

    const years = Object.keys(yearGroups).sort();
    years.forEach((year, idx) => {
      const yearData = yearGroups[year];
      const startPt = yearData[0];
      const endPt = yearData[yearData.length - 1];

      let prevEndWorth = 0;
      if (idx > 0) {
        const prevYearData = yearGroups[years[idx - 1]];
        prevEndWorth = prevYearData[prevYearData.length - 1].netWorth;
      } else {
        // For the first year, start worth is the actual current net worth
        prevEndWorth = monthlyHistory[0].netWorth;
      }

      const yearlyChange = endPt.netWorth - prevEndWorth;
      const yearlyChangePct = prevEndWorth !== 0 ? (yearlyChange / Math.abs(prevEndWorth)) * 100 : 0;

      yearlyHistory.push({
        year,
        startNetWorth: prevEndWorth,
        endNetWorth: endPt.netWorth,
        change: yearlyChange,
        changePercent: yearlyChangePct
      });
    });

    return {
      months: projectionMonths,
      monthlyHistory,
      yearlyHistory
    };
  };

  const { monthlyHistory = [], yearlyHistory = [] } = runSimulation();

  // Helper formatting functions
  const formatCurrency = (val) => {
    const absVal = Math.abs(val);
    const formatted = absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (val < 0 ? '-' : '') + '$' + formatted;
  };

  const formatShortCurrency = (val) => {
    const absVal = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (absVal >= 1.0e6) {
      return sign + '$' + (absVal / 1.0e6).toFixed(1) + 'M';
    } else if (absVal >= 1.0e3) {
      return sign + '$' + (absVal / 1.0e3).toFixed(0) + 'k';
    }
    return sign + '$' + absVal.toFixed(0);
  };

  const formatMonthLabel = (monthStr) => {
    if (!monthStr) return '';
    const [year, monthNum] = monthStr.split('-');
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return `${monthNames[parseInt(monthNum, 10) - 1]} ${year}`;
  };

  // SVG Chart Config
  const chartWidth = 600;
  const chartHeight = 280;
  const paddingTop = 30;
  const paddingBottom = 40;
  const paddingLeft = 70;
  const paddingRight = 20;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;
  const N = monthlyHistory.length;

  const netWorths = monthlyHistory.map(d => d.netWorth);
  let minNW = Math.min(...netWorths);
  let maxNW = Math.max(...netWorths);

  if (N <= 1) {
    minNW = minNW - 1000;
    maxNW = maxNW + 1000;
  }

  const nwRange = maxNW - minNW;
  const nwMin = nwRange === 0 ? minNW - 1000 : minNW - nwRange * 0.15;
  const nwMax = nwRange === 0 ? maxNW + 1000 : maxNW + nwRange * 0.15;

  const getX = (idx) => {
    if (N <= 1) return paddingLeft + plotWidth / 2;
    return paddingLeft + (idx / (N - 1)) * plotWidth;
  };

  const getY = (val) => {
    if (nwMax === nwMin) return paddingTop + plotHeight / 2;
    return chartHeight - paddingBottom - ((val - nwMin) / (nwMax - nwMin)) * plotHeight;
  };

  const pathD = N > 0 ? monthlyHistory.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(pt.netWorth)}`).join(' ') : '';
  const areaD = N > 0 ? `${pathD} L ${getX(N - 1)} ${chartHeight - paddingBottom} L ${getX(0)} ${chartHeight - paddingBottom} Z` : '';

  const yTicks = [];
  for (let i = 0; i <= 3; i++) {
    yTicks.push(nwMin + (i / 3) * (nwMax - nwMin));
  }

  let alignTransform = 'translate(-50%, -115%)';
  if (N > 1 && hoveredIdx !== null) {
    if (hoveredIdx === 0) {
      alignTransform = 'translate(0%, -115%)';
    } else if (hoveredIdx === N - 1) {
      alignTransform = 'translate(-100%, -115%)';
    }
  }

  const isScenarioLongerThanYear = monthlyHistory.length > 12;

  // Onboarding Screen if no scenarios exist
  if (scenarios.length === 0 && !isCreating) {
    return (
      <div className="fade-in" style={{ maxWidth: '600px', margin: '2rem auto', width: '100%' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)' }}>
              <Sliders size={32} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem' }}>Scenario Planning</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Model forward-looking simulations to project your future wealth timeline.</p>
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Model interest rates compounding monthly, recurring monthly cash flows, and one-time future asset sales or debt payoffs to see a visual map of your projected net worth.
          </p>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
            <button 
              onClick={() => setIsCreating(true)}
              className="btn btn-primary"
              style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', padding: '0.6rem 2rem' }}
            >
              <Plus size={16} />
              Create First Scenario
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* 1. TOP TOOLBAR & SELECTORS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders className="text-primary" />
            Financial Scenario Planning
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Project and simulate future asset growth, liabilities reductions, and net worth progress.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {scenarios.length > 0 && !isCreating && (
            isRenaming ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input 
                  type="text" 
                  className="input" 
                  style={{ width: '180px', height: '38px', fontSize: '0.9rem', padding: '0 0.55rem' }}
                  value={renameText}
                  onChange={(e) => setRenameText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename();
                    if (e.key === 'Escape') setIsRenaming(false);
                  }}
                  autoFocus
                />
                <button 
                  onClick={handleSaveRename}
                  className="btn btn-primary btn-sm"
                  style={{ height: '38px', width: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--success)', backgroundImage: 'none' }}
                  title="Save Name"
                >
                  <Check size={16} />
                </button>
                <button 
                  onClick={() => setIsRenaming(false)}
                  className="btn btn-secondary btn-sm"
                  style={{ height: '38px', width: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Cancel"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <select 
                  className="input select"
                  style={{ width: '180px', padding: '0.45rem' }}
                  value={activeScenarioId}
                  onChange={(e) => setActiveScenarioId(e.target.value)}
                >
                  {scenarios.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>

                <button 
                  onClick={() => setIsCreating(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ height: '38px', width: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Create New Scenario"
                >
                  <Plus size={16} />
                </button>

                <button 
                  onClick={() => {
                    setRenameText(activeScenario.name);
                    setIsRenaming(true);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ height: '38px', width: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Rename Selected Scenario"
                >
                  <Edit2 size={16} />
                </button>

                <button 
                  onClick={() => handleDuplicateScenario(activeScenario)}
                  className="btn btn-secondary btn-sm"
                  style={{ height: '38px', width: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Duplicate Selected Scenario"
                >
                  <Copy size={16} />
                </button>

                <button 
                  onClick={() => handleDeleteScenario(activeScenario.id)}
                  className="btn btn-secondary btn-sm"
                  style={{ height: '38px', width: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', borderColor: 'rgba(220,38,38,0.1)' }}
                  title="Delete Selected Scenario"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* 2. CREATING SCENARIO MODAL / ONBOARD CARD */}
      {isCreating && (
        <div className="card fade-in" style={{ border: '2px solid var(--primary)', maxWidth: '550px', margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} className="text-primary" />
              Configure New Scenario
            </h3>
            {scenarios.length > 0 && (
              <button 
                onClick={() => setIsCreating(false)} 
                className="btn btn-secondary btn-sm"
                style={{ padding: '4px', minHeight: 'auto' }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          <form onSubmit={handleCreateScenario} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label htmlFor="scenarioName">Scenario Title Name</label>
              <input 
                id="scenarioName"
                type="text" 
                className="input"
                placeholder="e.g. Retirement 5% Compound"
                value={newScenarioName}
                onChange={(e) => setNewScenarioName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="scenarioEndDate">Projection Ending Date</label>
              <input 
                id="scenarioEndDate"
                type="month" 
                className="input"
                value={newScenarioEndDate}
                min={new Date().toISOString().substring(0, 7)}
                onChange={(e) => setNewScenarioEndDate(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', padding: '10px', backgroundColor: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <Info size={16} className="text-primary" style={{ flexShrink: 0 }} />
              <span>We will automatically seed this scenario's baseline income & category expenses based on your actual transaction records from the previous month. You can adjust them anytime.</span>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              {scenarios.length > 0 && (
                <button 
                  type="button" 
                  onClick={() => setIsCreating(false)} 
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              )}
              <button type="submit" className="btn btn-primary">
                Initialize Scenario
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. SIMULATOR SETTINGS PANEL (ONLY WHEN SCENARIO IS ACTIVE) */}
      {activeScenario && !isCreating && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* ASSUMPTIONS BLOCK */}
          <div className="grid-cols-2" style={{ alignItems: 'start' }}>
            
            {/* COLUMN A: RECURRING MONTHLY FLOW ASSUMPTIONS */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title" style={{ margin: 0 }}>
                  <DollarSign size={18} className="text-primary" />
                  Monthly Recurring Cash Flows
                </h3>
                <button 
                  onClick={() => setEditingFlows(p => !p)} 
                  className="btn btn-secondary btn-sm"
                >
                  {editingFlows ? 'Finish Editing' : 'Adjust Baselines'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* A1: MONTHLY INCOME */}
                <div style={{ padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(16,185,129,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--success)' }}>Monthly Income</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={activeScenario.income?.active !== false}
                        onChange={(e) => {
                          updateActiveScenario(s => ({
                            ...s,
                            income: {
                              ...(s.income || { amount: 0, accountId: '' }),
                              active: e.target.checked
                            }
                          }));
                        }}
                      />
                      Include in simulation
                    </label>
                  </div>

                  {editingFlows ? (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <div className="form-group" style={{ flexGrow: 1, marginBottom: 0 }}>
                        <label style={{ fontSize: '0.7rem' }}>Amount ($)</label>
                        <input 
                          type="number"
                          className="input"
                          style={{ height: '34px', fontSize: '0.85rem' }}
                          value={activeScenario.income?.amount ?? 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateActiveScenario(s => ({
                              ...s,
                              income: {
                                ...(s.income || { accountId: '', active: true }),
                                amount: val
                              }
                            }));
                          }}
                        />
                      </div>
                      <div className="form-group" style={{ flexGrow: 1, marginBottom: 0 }}>
                        <label style={{ fontSize: '0.7rem' }}>Deposit Account</label>
                        <select 
                          className="input select"
                          style={{ height: '34px', fontSize: '0.85rem', padding: '0 0.5rem' }}
                          value={activeScenario.income?.accountId || ''}
                          onChange={(e) => {
                            updateActiveScenario(s => ({
                              ...s,
                              income: {
                                ...(s.income || { amount: 0, active: true }),
                                accountId: e.target.value
                              }
                            }));
                          }}
                        >
                          <option value="">-- Select --</option>
                          {accounts.filter(a => a.type !== 'summary' && a.type !== 'loan').map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--success)' }}>
                        {formatCurrency(activeScenario.income?.active !== false ? (activeScenario.income?.amount || 0) : 0)}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Deposits to: {accounts.find(a => a.id === activeScenario.income?.accountId)?.name || 'None Assigned'}
                      </span>
                    </div>
                  )}

                  {/* Future changes for Income */}
                  {activeScenario.income?.active !== false && (
                    editingFlows ? (
                      <div style={{ marginTop: '12px', padding: '8px', border: '1px dashed var(--border-color)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '600', color: 'var(--text-muted)' }}>Add Scheduled Income Change:</span>
                        
                        {activeScenario.income?.changes?.map(ch => (
                          <div key={ch.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', backgroundColor: 'rgba(255,255,255,0.02)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                            <span>Starting {formatMonthLabel(ch.date)}: <strong>{formatCurrency(ch.amount)}</strong></span>
                            <button 
                              onClick={() => handleDeleteIncomeChange(ch.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                              title="Delete Change"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input 
                            type="month" 
                            className="input" 
                            style={{ height: '28px', fontSize: '0.75rem', flexGrow: 1, padding: '0 4px' }}
                            value={addIncomeChangeDate}
                            min={new Date().toISOString().substring(0, 7)}
                            onChange={(e) => setAddIncomeChangeDate(e.target.value)}
                          />
                          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexGrow: 1 }}>
                            <span style={{ position: 'absolute', left: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>$</span>
                            <input 
                              type="number" 
                              className="input" 
                              placeholder="New Amt"
                              style={{ height: '28px', fontSize: '0.75rem', padding: '0 4px 0 14px' }}
                              value={addIncomeChangeVal}
                              onChange={(e) => setAddIncomeChangeVal(e.target.value)}
                            />
                          </div>
                          <button 
                            onClick={handleAddIncomeChange}
                            className="btn btn-secondary btn-sm"
                            style={{ height: '28px', padding: '0 8px', fontSize: '0.7rem' }}
                            disabled={!addIncomeChangeDate || addIncomeChangeVal === ''}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    ) : (
                      activeScenario.income?.changes && activeScenario.income.changes.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '0.75rem', borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Scheduled Amount Changes:</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {activeScenario.income.changes.map(ch => (
                              <div key={ch.id} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                                <span>Starting {formatMonthLabel(ch.date)}:</span>
                                <span style={{ color: 'var(--success)', fontWeight: '600' }}>{formatCurrency(ch.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>

                {/* A2: MONTHLY EXPENSES LIST */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Monthly Expenses by Category</span>
                  
                  {activeScenario.expenses?.length === 0 ? (
                    <div style={{ padding: '1rem', border: '1px dashed var(--border-color)', borderRadius: '6px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      No recurring category expenses seeded.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                      {activeScenario.expenses.map((exp, idx) => {
                        const categoryName = categories.find(c => c.id === exp.categoryId)?.name || 'Unknown';
                        return (
                          <div 
                            key={exp.categoryId} 
                            style={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              gap: '6px', 
                              padding: '8px 10px', 
                              borderRadius: '6px', 
                              border: '1px solid var(--border-color)', 
                              backgroundColor: exp.active ? 'rgba(255,255,255,0.01)' : 'transparent',
                              opacity: exp.active ? 1 : 0.5,
                              transition: 'opacity 0.2s ease'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer' }}>
                                <input 
                                  type="checkbox"
                                  checked={exp.active}
                                  onChange={(e) => {
                                    const updatedExps = [...activeScenario.expenses];
                                    updatedExps[idx] = { ...exp, active: e.target.checked };
                                    updateActiveScenario(s => ({ ...s, expenses: updatedExps }));
                                  }}
                                />
                                {categoryName}
                              </label>

                              {!editingFlows && (
                                <span style={{ fontWeight: '700', color: 'var(--danger)', fontSize: '0.85rem' }}>
                                  -{formatCurrency(exp.active ? (exp.amount || 0) : 0)}
                                </span>
                              )}
                            </div>

                            {editingFlows ? (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', position: 'relative', flexGrow: 1 }}>
                                  <span style={{ position: 'absolute', left: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>$</span>
                                  <input 
                                    type="number"
                                    className="input"
                                    style={{ height: '28px', fontSize: '0.8rem', padding: '0 4px 0 16px' }}
                                    value={exp.amount || 0}
                                    onChange={(e) => {
                                      const updatedExps = [...activeScenario.expenses];
                                      updatedExps[idx] = { ...exp, amount: parseFloat(e.target.value) || 0 };
                                      updateActiveScenario(s => ({ ...s, expenses: updatedExps }));
                                    }}
                                  />
                                </div>
                                <select 
                                  className="input select"
                                  style={{ height: '28px', fontSize: '0.78rem', width: '130px', padding: '0 4px' }}
                                  value={exp.accountId || ''}
                                  onChange={(e) => {
                                    const updatedExps = [...activeScenario.expenses];
                                    updatedExps[idx] = { ...exp, accountId: e.target.value };
                                    updateActiveScenario(s => ({ ...s, expenses: updatedExps }));
                                  }}
                                >
                                  <option value="">-- Account --</option>
                                  {accounts.filter(a => a.type !== 'summary' && a.type !== 'loan').map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Paid from: {accounts.find(a => a.id === exp.accountId)?.name || 'None Assigned'}
                              </span>
                            )}

                            {/* Future changes for this Category */}
                            {exp.active && (
                              editingFlows ? (
                                <div style={{ marginTop: '8px', padding: '6px', border: '1px dashed var(--border-color)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span style={{ fontSize: '0.68rem', fontWeight: '600', color: 'var(--text-muted)' }}>Add Scheduled Expense Change:</span>
                                  
                                  {exp.changes?.map(ch => (
                                    <div key={ch.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', backgroundColor: 'rgba(255,255,255,0.02)', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                      <span>Starting {formatMonthLabel(ch.date)}: <strong>{formatCurrency(ch.amount)}</strong></span>
                                      <button 
                                        onClick={() => handleDeleteExpenseChange(exp.categoryId, ch.id)}
                                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '1px', display: 'flex', alignItems: 'center' }}
                                        title="Delete Change"
                                      >
                                        <X size={10} />
                                      </button>
                                    </div>
                                  ))}

                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <input 
                                      type="month" 
                                      className="input" 
                                      style={{ height: '24px', fontSize: '0.7rem', flexGrow: 1, padding: '0 3px' }}
                                      value={addExpenseChangeDate[exp.categoryId] || ''}
                                      min={new Date().toISOString().substring(0, 7)}
                                      onChange={(e) => setAddExpenseChangeDate(prev => ({ ...prev, [exp.categoryId]: e.target.value }))}
                                    />
                                    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexGrow: 1 }}>
                                      <span style={{ position: 'absolute', left: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>$</span>
                                      <input 
                                        type="number" 
                                        className="input" 
                                        placeholder="New Amt"
                                        style={{ height: '24px', fontSize: '0.7rem', padding: '0 3px 0 10px' }}
                                        value={addExpenseChangeVal[exp.categoryId] ?? ''}
                                        onChange={(e) => setAddExpenseChangeVal(prev => ({ ...prev, [exp.categoryId]: e.target.value }))}
                                      />
                                    </div>
                                    <button 
                                      onClick={() => handleAddExpenseChange(exp.categoryId)}
                                      className="btn btn-secondary btn-sm"
                                      style={{ height: '24px', padding: '0 6px', fontSize: '0.65rem', minHeight: 'auto' }}
                                      disabled={!addExpenseChangeDate[exp.categoryId] || addExpenseChangeVal[exp.categoryId] === undefined || addExpenseChangeVal[exp.categoryId] === ''}
                                    >
                                      Add
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                exp.changes && exp.changes.length > 0 && (
                                  <div style={{ marginTop: '6px', fontSize: '0.72rem', borderTop: '1px dashed var(--border-color)', paddingTop: '4px' }}>
                                    <span style={{ color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '2px' }}>Scheduled Amount Changes:</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      {exp.changes.map(ch => (
                                        <div key={ch.id} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                                          <span>Starting {formatMonthLabel(ch.date)}:</span>
                                          <span style={{ color: 'var(--danger)', fontWeight: '600' }}>-{formatCurrency(ch.amount)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* COLUMN B: ACCOUNT SPECIFIC ASSUMPTIONS (GROWTH & MANUAL OVERRIDES) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 className="card-title" style={{ margin: 0 }}>
                  <TrendingUp size={18} className="text-primary" />
                  Account Specific Growth Assumptions
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {accounts.map(acc => {
                    const currentBalance = currentBalances[acc.id] || 0;
                    const assumptions = activeScenario.accountAssumptions?.[acc.id] || { yearlyInterestRate: 0, overrides: [] };
                    const hasOverrides = assumptions.overrides && assumptions.overrides.length > 0;

                    return (
                      <div 
                        key={acc.id} 
                        style={{ 
                          padding: '1rem', 
                          borderRadius: '8px', 
                          border: '1px solid var(--border-color)', 
                          backgroundColor: 'rgba(255,255,255,0.01)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        {/* Title and Balance */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-main)' }}>{acc.name}</span>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Type: {acc.bank}</div>
                          </div>
                          <span 
                            style={{ 
                              fontWeight: '700', 
                              fontSize: '1rem', 
                              color: currentBalance >= 0 ? 'var(--success)' : 'var(--danger)' 
                            }}
                          >
                            {formatCurrency(currentBalance)}
                          </span>
                        </div>

                        {/* Compound Interest settings */}
                        {acc.type === 'loan' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span style={{ color: 'var(--primary)' }}>★</span>
                            <span>Fixed loan payoff ({acc.apr}% APR, {acc.lengthMonths} months).</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0 }}>Yearly Compounding Rate (%):</label>
                            <input 
                              type="number"
                              className="input"
                              style={{ height: '30px', width: '80px', fontSize: '0.85rem' }}
                              value={assumptions.yearlyInterestRate}
                              min="-100"
                              max="1000"
                              step="0.01"
                              onChange={(e) => handleInterestRateChange(acc.id, e.target.value)}
                            />
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Compounded monthly</span>
                          </div>
                        )}

                        {/* Overdraft / Sweep Backup Account settings */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                          <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0 }}>Overdraft Backup Account:</label>
                          <select 
                            className="input select"
                            style={{ height: '30px', fontSize: '0.8rem', padding: '2px 8px', maxWidth: '200px', flexGrow: 1 }}
                            value={assumptions.backupAccountId || ''}
                            onChange={(e) => handleBackupAccountChange(acc.id, e.target.value)}
                          >
                            <option value="">-- None --</option>
                            {accounts.filter(a => a.id !== acc.id).map(a => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Future Overrides block */}
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                            Future Date Overrides
                          </span>

                          {/* List of existing overrides */}
                          {hasOverrides && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                              {assumptions.overrides.map(o => (
                                <div 
                                  key={o.id} 
                                  style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    padding: '4px 8px', 
                                    borderRadius: '4px', 
                                    backgroundColor: 'rgba(255,255,255,0.02)', 
                                    border: '1px solid var(--border-color)',
                                    fontSize: '0.72rem' 
                                  }}
                                >
                                  <span>{formatMonthLabel(o.date)}: <strong>{formatCurrency(o.balance)}</strong></span>
                                  <button 
                                    onClick={() => handleDeleteOverride(acc.id, o.id)}
                                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                    title="Delete Override"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Inline Override Form */}
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <input 
                              type="month" 
                              className="input" 
                              style={{ height: '28px', fontSize: '0.75rem', flexGrow: 1, padding: '0 4px' }}
                              value={addOverrideDate[acc.id] || ''}
                              min={new Date().toISOString().substring(0, 7)}
                              onChange={(e) => setAddOverrideDate(p => ({ ...p, [acc.id]: e.target.value }))}
                            />
                            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexGrow: 1 }}>
                              <span style={{ position: 'absolute', left: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>$</span>
                              <input 
                                type="number" 
                                className="input" 
                                placeholder="Target Bal"
                                style={{ height: '28px', fontSize: '0.75rem', padding: '0 4px 0 14px' }}
                                value={addOverrideVal[acc.id] ?? ''}
                                onChange={(e) => setAddOverrideVal(p => ({ ...p, [acc.id]: e.target.value }))}
                              />
                            </div>
                            <button 
                              onClick={() => handleAddOverride(acc.id)}
                              className="btn btn-secondary btn-sm"
                              style={{ height: '28px', padding: '0 8px', fontSize: '0.7rem' }}
                              disabled={!addOverrideDate[acc.id] || addOverrideVal[acc.id] === undefined || addOverrideVal[acc.id] === ''}
                            >
                              Add Set
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

          {/* 4. RESULTS SECTION: CHART & BREAKDOWNS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* TAB SELECTOR FOR VISUAL RESULTS */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1rem' }}>
              <button 
                onClick={() => setExpandedSection('projection')} 
                style={{ 
                  padding: '0.75rem 1rem', 
                  background: 'none', 
                  border: 'none', 
                  color: expandedSection === 'projection' ? 'var(--primary)' : 'var(--text-muted)', 
                  borderBottom: expandedSection === 'projection' ? '2px solid var(--primary)' : '2px solid transparent', 
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.95rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart3 size={16} />
                  Projected Net Worth Trend
                </div>
              </button>

              <button 
                onClick={() => setExpandedSection('details')} 
                style={{ 
                  padding: '0.75rem 1rem', 
                  background: 'none', 
                  border: 'none', 
                  color: expandedSection === 'details' ? 'var(--primary)' : 'var(--text-muted)', 
                  borderBottom: expandedSection === 'details' ? '2px solid var(--primary)' : '2px solid transparent', 
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.95rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wallet size={16} />
                  Monthly Ledger Projection
                </div>
              </button>
            </div>

            {/* TAB CONTENT A: CHART & YoY TABLES */}
            {expandedSection === 'projection' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* SVG CHART */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="card-title" style={{ margin: 0 }}>Projected Wealth Growth</h3>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem' }}>
                      <span>Start: <strong>{formatCurrency(monthlyHistory[0]?.netWorth || 0)}</strong></span>
                      <span>Simulated End: <strong>{formatCurrency(monthlyHistory[monthlyHistory.length - 1]?.netWorth || 0)}</strong></span>
                    </div>
                  </div>

                  <div style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
                    <svg 
                      viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                      width="100%" 
                      height="auto" 
                      style={{ overflow: 'visible' }}
                    >
                      <defs>
                        <linearGradient id="simGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Grid lines */}
                      {yTicks.map((val, idx) => {
                        const y = getY(val);
                        return (
                          <g key={idx}>
                            <line 
                              x1={paddingLeft} 
                              y1={y} 
                              x2={chartWidth - paddingRight} 
                              y2={y} 
                              stroke="var(--border-color)" 
                              strokeDasharray="4 4" 
                            />
                            <text 
                              x={paddingLeft - 10} 
                              y={y + 4} 
                              textAnchor="end" 
                              fontSize="10" 
                              fill="var(--text-muted)"
                              style={{ fontFamily: 'var(--font-sans)', fontWeight: '500' }}
                            >
                              {formatShortCurrency(val)}
                            </text>
                          </g>
                        );
                      })}

                      {/* Area Path */}
                      {N > 0 && (
                        <path 
                          d={areaD} 
                          fill="url(#simGradient)" 
                        />
                      )}

                      {/* Trend Line Path */}
                      {N > 0 && (
                        <path 
                          d={pathD} 
                          fill="none" 
                          stroke="var(--primary)" 
                          strokeWidth={3} 
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Data points */}
                      {monthlyHistory.map((pt, idx) => {
                        const skipCircle = N > 30 && idx % Math.ceil(N / 15) !== 0 && idx !== N - 1;
                        if (skipCircle && hoveredIdx !== idx) return null;
                        
                        return (
                          <circle 
                            key={idx}
                            cx={getX(idx)} 
                            cy={getY(pt.netWorth)} 
                            r={hoveredIdx === idx ? 6 : 4} 
                            fill={hoveredIdx === idx ? 'var(--primary)' : 'var(--bg-app)'} 
                            stroke="var(--primary)" 
                            strokeWidth={2} 
                            style={{ transition: 'r 0.15s ease, fill 0.15s ease' }}
                          />
                        );
                      })}

                      {/* Vertical Focus line on hover */}
                      {hoveredIdx !== null && (
                        <line 
                          x1={getX(hoveredIdx)} 
                          y1={paddingTop} 
                          x2={getX(hoveredIdx)} 
                          y2={chartHeight - paddingBottom} 
                          stroke="var(--primary)" 
                          strokeDasharray="3 3" 
                          opacity="0.5" 
                        />
                      )}

                      {/* X Axis Labels */}
                      {monthlyHistory.map((pt, idx) => {
                        const skip = N > 12 && idx % Math.ceil(N / 8) !== 0 && idx !== N - 1;
                        if (skip) return null;
                        
                        const x = getX(idx);
                        return (
                          <text 
                            key={idx}
                            x={x} 
                            y={chartHeight - paddingBottom + 20} 
                            textAnchor="middle" 
                            fontSize="10" 
                            fill="var(--text-muted)"
                            style={{ fontFamily: 'var(--font-sans)', fontWeight: '500' }}
                          >
                            {formatMonthLabel(pt.month)}
                          </text>
                        );
                      })}

                      {/* Interactive Vertical Hover Bands */}
                      {monthlyHistory.map((pt, idx) => {
                        const x = getX(idx);
                        const step = N <= 1 ? plotWidth : plotWidth / (N - 1);
                        const bandW = N <= 1 ? plotWidth : step;
                        const bandX = N <= 1 ? paddingLeft : x - step / 2;

                        return (
                          <rect 
                            key={idx}
                            x={bandX}
                            y={paddingTop}
                            width={bandW}
                            height={plotHeight}
                            fill="transparent"
                            onMouseEnter={() => setHoveredIdx(idx)}
                            onMouseMove={() => setHoveredIdx(idx)}
                            onMouseLeave={() => setHoveredIdx(null)}
                            style={{ cursor: 'pointer' }}
                          />
                        );
                      })}
                    </svg>

                    {/* Interactive Tooltip popup */}
                    {hoveredIdx !== null && monthlyHistory[hoveredIdx] && (
                      <div 
                        style={{
                          position: 'absolute',
                          left: `${(getX(hoveredIdx) / chartWidth) * 100}%`,
                          top: `${(getY(monthlyHistory[hoveredIdx].netWorth) / chartHeight) * 100}%`,
                          transform: alignTransform,
                          pointerEvents: 'none',
                          zIndex: 10,
                          minWidth: '220px',
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          backgroundColor: 'var(--glass-bg)',
                          backdropFilter: 'var(--glass-blur)',
                          border: '1px solid var(--border-color)',
                          boxShadow: 'var(--shadow-lg)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          transition: 'left 0.1s ease, top 0.1s ease'
                        }}
                      >
                        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                          {formatMonthLabel(monthlyHistory[hoveredIdx].month)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Projected Assets:</span>
                          <span style={{ color: 'var(--success)', fontWeight: '600' }}>
                            {formatCurrency(monthlyHistory[hoveredIdx].assets)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Projected Liabilities:</span>
                          <span style={{ color: 'var(--danger)', fontWeight: '600' }}>
                            {formatCurrency(monthlyHistory[hoveredIdx].liabilities)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '700', borderTop: '1px solid var(--border-color)', paddingTop: '4px', marginTop: '2px' }}>
                          <span style={{ color: 'var(--text-main)' }}>Projected Net Worth:</span>
                          <span style={{ color: 'var(--primary)' }}>
                            {formatCurrency(monthlyHistory[hoveredIdx].netWorth)}
                          </span>
                        </div>
                        {hoveredIdx > 0 && (
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            fontSize: '0.7rem', 
                            color: monthlyHistory[hoveredIdx].netWorth - monthlyHistory[hoveredIdx - 1].netWorth >= 0 ? 'var(--success)' : 'var(--danger)', 
                            fontWeight: '500' 
                          }}>
                            <span>MoM Change:</span>
                            <span>
                              {monthlyHistory[hoveredIdx].netWorth - monthlyHistory[hoveredIdx - 1].netWorth >= 0 ? '+' : ''}
                              {formatCurrency(monthlyHistory[hoveredIdx].netWorth - monthlyHistory[hoveredIdx - 1].netWorth)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* YEARLY CHANGES TABLE (SHOWN ONLY IF PROJECTION > 1 YEAR) */}
                {isScenarioLongerThanYear && (
                  <div className="card fade-in">
                    <h3 className="card-title">
                      <Calendar size={18} className="text-primary" />
                      Annual Projection Consolidation
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                      Year-over-Year (YoY) projected benchmarks based on compounding compounding rules.
                    </p>

                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Projection Year</th>
                            <th style={{ textAlign: 'right' }}>Year Opening Balance</th>
                            <th style={{ textAlign: 'right' }}>Year Closing Balance</th>
                            <th style={{ textAlign: 'right' }}>Annual Net Progress</th>
                            <th style={{ textAlign: 'right' }}>YoY Growth Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {yearlyHistory.map(y => {
                            const isPositive = y.change >= 0;
                            return (
                              <tr key={y.year}>
                                <td style={{ fontWeight: '700', color: 'var(--text-main)' }}>{y.year}</td>
                                <td style={{ textAlign: 'right', fontWeight: '500' }}>{formatCurrency(y.startNetWorth)}</td>
                                <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--text-main)' }}>{formatCurrency(y.endNetWorth)}</td>
                                <td 
                                  style={{ 
                                    textAlign: 'right', 
                                    fontWeight: '700', 
                                    color: isPositive ? 'var(--success)' : 'var(--danger)' 
                                  }}
                                >
                                  {isPositive ? '+' : ''}{formatCurrency(y.change)}
                                </td>
                                <td 
                                  style={{ 
                                    textAlign: 'right', 
                                    fontWeight: '700', 
                                    color: isPositive ? 'var(--success)' : 'var(--danger)' 
                                  }}
                                >
                                  {isPositive ? '+' : ''}{y.changePercent.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* TAB CONTENT B: DETAILED MONTHLY LEDGER PROJECTION */}
            {expandedSection === 'details' && (
              <div className="card fade-in">
                <h3 className="card-title">
                  <Wallet size={18} className="text-primary" />
                  Projected Monthly Balance Sheets
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  Detailed month-by-month breakdowns of individual account balances and cumulative net worth.
                </p>

                <div className="table-container" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '600px' }}>
                  <table style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ position: 'sticky', top: 0, left: 0, backgroundColor: 'var(--bg-input)', zIndex: 20, borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', boxShadow: '2px 2px 5px rgba(0,0,0,0.1)' }}>Month</th>
                        {accounts.map(acc => (
                          <th key={acc.id} style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-input)', zIndex: 12, borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>{acc.name}</th>
                        ))}
                        <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-input)', zIndex: 12, borderBottom: '1px solid var(--border-color)', textAlign: 'right', borderLeft: '1px solid var(--border-color)', paddingLeft: '15px' }}>Projected Net Worth</th>
                        <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-input)', zIndex: 12, borderBottom: '1px solid var(--border-color)', textAlign: 'right', paddingLeft: '15px' }}>Cash Flow</th>
                        <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-input)', zIndex: 12, borderBottom: '1px solid var(--border-color)', textAlign: 'right', paddingLeft: '15px' }}>Net Worth Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyHistory.map((row) => (
                        <tr key={row.month}>
                          <td style={{ fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap', position: 'sticky', left: 0, backgroundColor: 'var(--bg-input)', zIndex: 10, borderRight: '1px solid var(--border-color)', boxShadow: '2px 0 5px rgba(0,0,0,0.05)' }}>
                            {formatMonthLabel(row.month)}
                          </td>
                          {accounts.map(acc => {
                            const bal = row.balances[acc.id] || 0;
                            return (
                              <td 
                                key={acc.id} 
                                style={{ 
                                  textAlign: 'right', 
                                  fontWeight: '500', 
                                  color: bal >= 0 ? 'var(--success)' : 'var(--danger)',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {formatCurrency(bal)}
                              </td>
                            );
                          })}
                          <td 
                            style={{ 
                              textAlign: 'right', 
                              fontWeight: '700', 
                              color: 'var(--primary)',
                              borderLeft: '1px solid var(--border-color)', 
                              paddingLeft: '15px',
                              whiteSpace: 'nowrap' 
                            }}
                          >
                            {formatCurrency(row.netWorth)}
                          </td>
                          <td 
                            style={{ 
                              textAlign: 'right', 
                              fontWeight: '600', 
                              color: row.cashFlow >= 0 ? 'var(--success)' : 'var(--danger)',
                              paddingLeft: '15px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {row.cashFlow >= 0 ? '+' : ''}{formatCurrency(row.cashFlow)}
                          </td>
                          <td 
                            style={{ 
                              textAlign: 'right', 
                              fontWeight: '700', 
                              color: row.netWorthChange >= 0 ? 'var(--success)' : 'var(--danger)',
                              paddingLeft: '15px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {row.netWorthChange >= 0 ? '+' : ''}{formatCurrency(row.netWorthChange)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}

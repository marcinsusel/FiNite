import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpRight, 
  ArrowDownRight, Landmark, Briefcase, ChevronRight, ChevronDown, BarChart3, AlertCircle, X, ExternalLink
} from 'lucide-react';

export default function NetWorth({ transactions, accounts }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [hoveredCell, setHoveredCell] = useState(null); // { date, type, rect, items, isFirstMonth }
  const [activeModalCell, setActiveModalCell] = useState(null); // { date, type, items, isFirstMonth }
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedSection, setExpandedSection] = useState(null); // 'assets' | 'liabilities' | null
  const itemsPerPage = 6;

  useEffect(() => {
    setCurrentPage(1);
  }, [transactions.length, accounts.length]);

  // 1. Gather all unique dates to find the earliest history record
  const allDates = [];
  transactions.forEach(t => {
    if (t.date) allDates.push(t.date);
  });
  accounts.forEach(acc => {
    if (acc.balances) {
      acc.balances.forEach(b => {
        if (b.date) allDates.push(b.date);
      });
    }
  });

  // Earliest date string
  const minDate = allDates.length > 0 ? allDates.reduce((min, d) => d < min ? d : min, allDates[0]) : null;

  // 2. Generate list of month starts (YYYY-MM-01) from earliest date to current month
  const getMonthlyDates = (minDateStr) => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-11

    let startYear, startMonth;
    if (minDateStr) {
      const parts = minDateStr.split('-');
      startYear = parseInt(parts[0], 10);
      startMonth = parseInt(parts[1], 10) - 1; // 0-11
    } else {
      startYear = currentYear;
      startMonth = currentMonth;
    }

    const result = [];
    let y = startYear;
    let m = startMonth;

    while (y < currentYear || (y === currentYear && m <= currentMonth)) {
      const mm = String(m + 1).padStart(2, '0');
      const lastDay = new Date(y, m + 1, 0).getDate();
      const dd = String(lastDay).padStart(2, '0');
      result.push(`${y}-${mm}-${dd}`);
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
    
    // Ensure we have at least the current month
    const currentMonthLastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(currentMonthLastDay).padStart(2, '0')}`;
    if (result.length === 0 || !result.includes(currentMonthStr)) {
      if (!result.includes(currentMonthStr)) {
        result.push(currentMonthStr);
      }
    }
    return result;
  };

  const monthlyDates = getMonthlyDates(minDate);

  // 3. Compute balances for each month start
  const monthlyData = monthlyDates.map((D, idx) => {
    let assets = 0;
    let liabilities = 0;
    const prevD = idx > 0 ? monthlyDates[idx - 1] : null;
    const assetItems = [];
    const liabilityItems = [];

    accounts.forEach(acc => {
      let balance = 0;
      if (acc.type === 'summary' || acc.type === 'loan') {
        // Manual summary/loan account balance as of D: most recent entry <= D
        const sorted = [...(acc.balances || [])].sort((a, b) => b.date.localeCompare(a.date));
        const latest = sorted.find(entry => entry.date <= D);
        balance = latest ? latest.balance : 0;
      } else {
        // Transaction account balance as of D: sum of transactions <= D
        balance = transactions
          .filter(t => t.accountId === acc.id && t.date <= D)
          .reduce((sum, t) => sum + t.amount, 0);
      }

      if (balance > 0) {
        assets += balance;
      } else {
        liabilities += Math.abs(balance);
      }

      let prevBalance = 0;
      if (prevD) {
        if (acc.type === 'summary' || acc.type === 'loan') {
          const sorted = [...(acc.balances || [])].sort((a, b) => b.date.localeCompare(a.date));
          const latest = sorted.find(entry => entry.date <= prevD);
          prevBalance = latest ? latest.balance : 0;
        } else {
          prevBalance = transactions
            .filter(t => t.accountId === acc.id && t.date <= prevD)
            .reduce((sum, t) => sum + t.amount, 0);
        }
      }

      // Check if it's an asset or liability line item
      if (balance > 0 || (balance === 0 && prevBalance > 0)) {
        const prevAssetVal = prevBalance > 0 ? prevBalance : 0;
        assetItems.push({
          id: acc.id,
          name: acc.name,
          bank: acc.bank,
          url: acc.url,
          balance,
          change: balance - prevAssetVal
        });
      }

      if (balance < 0 || (balance === 0 && prevBalance < 0)) {
        const currentLiabVal = Math.abs(balance);
        const prevLiabVal = prevBalance < 0 ? Math.abs(prevBalance) : 0;
        liabilityItems.push({
          id: acc.id,
          name: acc.name,
          bank: acc.bank,
          url: acc.url,
          balance: currentLiabVal,
          change: currentLiabVal - prevLiabVal
        });
      }
    });

    const netWorth = assets - liabilities;
    return {
      date: D,
      assets,
      liabilities,
      netWorth,
      assetItems,
      liabilityItems
    };
  });

  // Calculate MoM changes
  const computedPoints = monthlyData.map((pt, idx) => {
    let change = 0;
    let changePercent = 0;
    if (idx > 0) {
      const prev = monthlyData[idx - 1];
      change = pt.netWorth - prev.netWorth;
      changePercent = prev.netWorth !== 0 ? (change / Math.abs(prev.netWorth)) * 100 : 0;
    }
    return {
      ...pt,
      change,
      changePercent
    };
  });

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

  const formatMonthLabel = (dateStr) => {
    const parts = dateStr.split('-');
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return `${monthNames[monthIndex]} ${year}`;
  };

  // If no accounts, display empty state
  if (accounts.length === 0) {
    return (
      <div className="card fade-in" style={{ padding: '3rem', textAlign: 'center', maxWidth: '600px', margin: '2rem auto' }}>
        <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary)', marginBottom: '1.5rem' }}>
          <AlertCircle size={36} />
        </div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>No Account Setup</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
          We need at least one checking, savings, credit, or summary account to compute your net worth timeline.
        </p>
      </div>
    );
  }

  // Active indices/metrics from computed data
  const latestData = computedPoints[computedPoints.length - 1];
  const currentNetWorth = latestData.netWorth;
  const currentAssets = latestData.assets;
  const currentLiabilities = latestData.liabilities;
  const currentChange = latestData.change;
  const currentChangePercent = latestData.changePercent;

  // Chart configuration constants
  const chartWidth = 600;
  const chartHeight = 280;
  const paddingTop = 30;
  const paddingBottom = 40;
  const paddingLeft = 70;
  const paddingRight = 20;

  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;
  const N = computedPoints.length;

  const netWorths = computedPoints.map(d => d.netWorth);
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

  // Generate SVG Path coordinates
  const pathD = N > 0 ? computedPoints.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(pt.netWorth)}`).join(' ') : '';
  const areaD = N > 0 ? `${pathD} L ${getX(N - 1)} ${chartHeight - paddingBottom} L ${getX(0)} ${chartHeight - paddingBottom} Z` : '';

  // Y-axis grid ticks
  const yTicks = [];
  for (let i = 0; i <= 3; i++) {
    yTicks.push(nwMin + (i / 3) * (nwMax - nwMin));
  }

  // Hover Tooltip Position Alignments
  let alignTransform = 'translate(-50%, -115%)';
  if (N > 1 && hoveredIdx !== null) {
    if (hoveredIdx === 0) {
      alignTransform = 'translate(0%, -115%)';
    } else if (hoveredIdx === N - 1) {
      alignTransform = 'translate(-100%, -115%)';
    }
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Top Banner Header */}
      <div>
        <h2 style={{ fontSize: '1.6rem' }}>Net Worth Dashboard</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Historical consolidation of your assets, liabilities, and cumulative wealth over time.
        </p>
      </div>

      {/* Metric Cards Row */}
      <div className="grid-cols-4">
        {/* Net Worth Stat Card */}
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>Net Worth</span>
            <div style={{ padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary)' }}>
              <Wallet size={18} />
            </div>
          </div>
          <div className="stat-val" style={{ color: 'var(--text-main)' }}>
            {formatCurrency(currentNetWorth)}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>As of current month</span>
        </div>

        {/* Total Assets Card */}
        <div 
          className="card stat-card" 
          onClick={() => setExpandedSection(prev => prev === 'assets' ? null : 'assets')}
          style={{ 
            borderLeft: '4px solid var(--success)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            transform: expandedSection === 'assets' ? 'translateY(-2px)' : 'none',
            boxShadow: expandedSection === 'assets' 
              ? '0 6px 20px rgba(34, 197, 94, 0.15)' 
              : 'var(--shadow-lg)',
            backgroundColor: expandedSection === 'assets' ? 'rgba(34, 197, 94, 0.04)' : 'var(--bg-card)',
            borderColor: expandedSection === 'assets' ? 'var(--success)' : 'var(--border-color)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Total Assets
              <ChevronDown 
                size={14} 
                style={{ 
                  transform: expandedSection === 'assets' ? 'rotate(180deg)' : 'none', 
                  transition: 'transform 0.2s ease',
                  color: expandedSection === 'assets' ? 'var(--success)' : 'var(--text-muted)'
                }} 
              />
            </span>
            <div style={{ padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.08)', color: 'var(--success)' }}>
              <Landmark size={18} />
            </div>
          </div>
          <div className="stat-val" style={{ color: 'var(--success)' }}>
            {formatCurrency(currentAssets)}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Cash + positive manual accounts</span>
        </div>

        {/* Total Liabilities Card */}
        <div 
          className="card stat-card" 
          onClick={() => setExpandedSection(prev => prev === 'liabilities' ? null : 'liabilities')}
          style={{ 
            borderLeft: '4px solid var(--danger)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            transform: expandedSection === 'liabilities' ? 'translateY(-2px)' : 'none',
            boxShadow: expandedSection === 'liabilities' 
              ? '0 6px 20px rgba(220, 38, 38, 0.15)' 
              : 'var(--shadow-lg)',
            backgroundColor: expandedSection === 'liabilities' ? 'rgba(220, 38, 38, 0.04)' : 'var(--bg-card)',
            borderColor: expandedSection === 'liabilities' ? 'var(--danger)' : 'var(--border-color)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Total Liabilities
              <ChevronDown 
                size={14} 
                style={{ 
                  transform: expandedSection === 'liabilities' ? 'rotate(180deg)' : 'none', 
                  transition: 'transform 0.2s ease',
                  color: expandedSection === 'liabilities' ? 'var(--danger)' : 'var(--text-muted)'
                }} 
              />
            </span>
            <div style={{ padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(220, 38, 38, 0.08)', color: 'var(--danger)' }}>
              <Briefcase size={18} style={{ transform: 'rotate(180deg)' }} />
            </div>
          </div>
          <div className="stat-val" style={{ color: 'var(--danger)' }}>
            {formatCurrency(currentLiabilities)}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Credit cards + negative manual balances</span>
        </div>

        {/* MoM Performance Card */}
        <div className="card stat-card" style={{ borderLeft: `4px solid ${currentChange >= 0 ? 'var(--success)' : 'var(--danger)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>MoM Performance</span>
            <div style={{ 
              padding: '6px', 
              borderRadius: '50%', 
              backgroundColor: currentChange >= 0 ? 'rgba(34, 197, 94, 0.08)' : 'rgba(220, 38, 38, 0.08)', 
              color: currentChange >= 0 ? 'var(--success)' : 'var(--danger)' 
            }}>
              {currentChange >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            </div>
          </div>
          <div className="stat-val" style={{ color: currentChange >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {currentChange >= 0 ? '+' : ''}{formatCurrency(currentChange)}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {currentChangePercent >= 0 ? '+' : ''}{currentChangePercent.toFixed(1)}% since last month
          </span>
        </div>
      </div>

      {/* Expanded Asset or Liability Details Section */}
      {expandedSection && (
        <div 
          className="card fade-in" 
          style={{ 
            borderLeft: `4px solid ${expandedSection === 'assets' ? 'var(--success)' : 'var(--danger)'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            animation: 'fadeIn 0.25s ease-out',
            backgroundColor: 'var(--glass-bg)',
            backdropFilter: 'var(--glass-blur)'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {expandedSection === 'assets' ? (
                  <>
                    <Landmark size={20} style={{ color: 'var(--success)' }} />
                    Active Assets Breakdown
                  </>
                ) : (
                  <>
                    <Briefcase size={20} style={{ color: 'var(--danger)', transform: 'rotate(180deg)' }} />
                    Active Liabilities Breakdown
                  </>
                )}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>
                All individual accounts comprising your {expandedSection} for {formatMonthLabel(latestData.date)} in decreasing amount order.
              </p>
            </div>
            <button 
              onClick={() => setExpandedSection(null)} 
              className="btn btn-secondary btn-sm" 
              style={{ padding: '6px', minHeight: 'auto' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Table Container */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Account Name</th>
                  <th>Bank / Institution</th>
                  <th style={{ textAlign: 'right' }}>Current Balance</th>
                  <th style={{ textAlign: 'right' }}>MoM Change</th>
                </tr>
              </thead>
              <tbody>
                {(expandedSection === 'assets'
                  ? [...(latestData.assetItems || [])].sort((a, b) => b.balance - a.balance)
                  : [...(latestData.liabilityItems || [])].sort((a, b) => b.balance - a.balance)
                ).map(item => {
                  let changeColor = 'var(--text-muted)';
                  let changeText = '$0.00';
                  const isFirstRow = latestData.date === computedPoints[0].date;

                  if (isFirstRow) {
                    changeColor = 'var(--text-muted)';
                    changeText = '--';
                  } else {
                    if (expandedSection === 'assets') {
                      if (item.change > 0) {
                        changeColor = 'var(--success)';
                        changeText = `+${formatCurrency(item.change)}`;
                      } else if (item.change < 0) {
                        changeColor = 'var(--danger)';
                        changeText = `-${formatCurrency(Math.abs(item.change))}`;
                      }
                    } else {
                      if (item.change > 0) {
                        changeColor = 'var(--danger)';
                        changeText = `+${formatCurrency(item.change)}`;
                      } else if (item.change < 0) {
                        changeColor = 'var(--success)';
                        changeText = `-${formatCurrency(Math.abs(item.change))}`;
                      }
                    }
                  }

                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                        {item.url ? (
                          <a 
                            href={item.url.startsWith('http') ? item.url : `https://${item.url}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{ 
                              fontWeight: '600', 
                              color: 'var(--primary)', 
                              textDecoration: 'underline dotted rgba(99, 102, 241, 0.4)',
                              textUnderlineOffset: '3px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title={`Open ${item.url} in new window`}
                          >
                            {item.name}
                            <ExternalLink size={12} style={{ opacity: 0.7 }} />
                          </a>
                        ) : (
                          item.name
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{item.bank}</td>
                      <td 
                        style={{ 
                          textAlign: 'right', 
                          fontWeight: '700', 
                          color: expandedSection === 'assets' ? 'var(--success)' : 'var(--danger)' 
                        }}
                      >
                        {formatCurrency(expandedSection === 'liabilities' ? -item.balance : item.balance)}
                      </td>
                      <td 
                        style={{ 
                          textAlign: 'right', 
                          fontWeight: '600', 
                          color: changeColor 
                        }}
                      >
                        {changeText}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SVG Line Chart Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 className="card-title">
          <BarChart3 size={18} className="text-primary" />
          Wealth Accumulation Trend
        </h3>

        <div style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
          <svg 
            viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
            width="100%" 
            height="auto" 
            style={{ overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
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
                fill="url(#chartGradient)" 
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
            {computedPoints.map((pt, idx) => (
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
            ))}

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
            {computedPoints.map((pt, idx) => {
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
                  {formatMonthLabel(pt.date)}
                </text>
              );
            })}

            {/* Interactive Vertical Hover Bands */}
            {computedPoints.map((pt, idx) => {
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

          {/* Glassmorphic Tooltip Card */}
          {hoveredIdx !== null && (
            <div 
              style={{
                position: 'absolute',
                left: `${(getX(hoveredIdx) / chartWidth) * 100}%`,
                top: `${(getY(computedPoints[hoveredIdx].netWorth) / chartHeight) * 100}%`,
                transform: alignTransform,
                pointerEvents: 'none',
                zIndex: 10,
                minWidth: '200px',
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
                {formatMonthLabel(computedPoints[hoveredIdx].date)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Assets:</span>
                <span style={{ color: 'var(--success)', fontWeight: '600' }}>
                  {formatCurrency(computedPoints[hoveredIdx].assets)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Liabilities:</span>
                <span style={{ color: 'var(--danger)', fontWeight: '600' }}>
                  {formatCurrency(computedPoints[hoveredIdx].liabilities)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '700', borderTop: '1px solid var(--border-color)', paddingTop: '4px', marginTop: '2px' }}>
                <span style={{ color: 'var(--text-main)' }}>Net Worth:</span>
                <span style={{ color: 'var(--primary)' }}>
                  {formatCurrency(computedPoints[hoveredIdx].netWorth)}
                </span>
              </div>
              {hoveredIdx > 0 && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  fontSize: '0.7rem', 
                  color: computedPoints[hoveredIdx].change >= 0 ? 'var(--success)' : 'var(--danger)', 
                  fontWeight: '500' 
                }}>
                  <span>MoM Change:</span>
                  <span>
                    {computedPoints[hoveredIdx].change >= 0 ? '+' : ''}
                    {formatCurrency(computedPoints[hoveredIdx].change)} ({computedPoints[hoveredIdx].changePercent >= 0 ? '+' : ''}{computedPoints[hoveredIdx].changePercent.toFixed(1)}%)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Historical Ledger Table */}
      <div className="card">
        <h3 className="card-title">
          <Landmark size={18} className="text-primary" />
          Historical Ledger
        </h3>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th style={{ textAlign: 'right' }}>Total Assets</th>
                <th style={{ textAlign: 'right' }}>Total Liabilities</th>
                <th style={{ textAlign: 'right' }}>Net Worth</th>
                <th style={{ textAlign: 'right' }}>MoM Change ($)</th>
                <th style={{ textAlign: 'right' }}>MoM Change (%)</th>
              </tr>
            </thead>
            <tbody>
              {/* Render list in descending chronological order for easier reading, paginated */}
              {[...computedPoints]
                .reverse()
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((pt, idx) => {
                  const isPositiveChange = pt.change >= 0;
                  const isFirstRow = pt.date === computedPoints[0].date;

                  return (
                  <tr key={pt.date}>
                    <td style={{ fontWeight: '600' }}>{formatMonthLabel(pt.date)}</td>
                    <td 
                      style={{ 
                        textAlign: 'right', 
                        color: 'var(--success)', 
                        fontWeight: '500',
                        cursor: 'pointer',
                        textDecoration: 'underline dotted rgba(34, 197, 94, 0.3)',
                        textUnderlineOffset: '4px'
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredCell({
                          date: pt.date,
                          type: 'assets',
                          rect,
                          items: pt.assetItems,
                          isFirstMonth: isFirstRow
                        });
                      }}
                      onMouseLeave={() => setHoveredCell(null)}
                      onClick={() => {
                        setHoveredCell(null);
                        setActiveModalCell({
                          date: pt.date,
                          type: 'assets',
                          items: pt.assetItems,
                          isFirstMonth: isFirstRow
                        });
                      }}
                    >
                      {formatCurrency(pt.assets)}
                    </td>
                    <td 
                      style={{ 
                        textAlign: 'right', 
                        color: 'var(--danger)', 
                        fontWeight: '500',
                        cursor: 'pointer',
                        textDecoration: 'underline dotted rgba(220, 38, 38, 0.3)',
                        textUnderlineOffset: '4px'
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredCell({
                          date: pt.date,
                          type: 'liabilities',
                          rect,
                          items: pt.liabilityItems,
                          isFirstMonth: isFirstRow
                        });
                      }}
                      onMouseLeave={() => setHoveredCell(null)}
                      onClick={() => {
                        setHoveredCell(null);
                        setActiveModalCell({
                          date: pt.date,
                          type: 'liabilities',
                          items: pt.liabilityItems,
                          isFirstMonth: isFirstRow
                        });
                      }}
                    >
                      {pt.liabilities > 0 ? '-' : ''}{formatCurrency(pt.liabilities)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>
                      {formatCurrency(pt.netWorth)}
                    </td>
                    {isFirstRow ? (
                      <>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontStyle: 'italic' }}>--</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontStyle: 'italic' }}>--</td>
                      </>
                    ) : (
                      <>
                        <td style={{ 
                          textAlign: 'right', 
                          fontWeight: '600', 
                          color: isPositiveChange ? 'var(--success)' : 'var(--danger)' 
                        }}>
                          {isPositiveChange ? '+' : ''}{formatCurrency(pt.change)}
                        </td>
                        <td style={{ 
                          textAlign: 'right', 
                          fontWeight: '600', 
                          color: isPositiveChange ? 'var(--success)' : 'var(--danger)' 
                        }}>
                          {isPositiveChange ? '+' : ''}{pt.changePercent.toFixed(1)}%
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Dynamic Pagination Controls */}
        {Math.ceil(computedPoints.length / itemsPerPage) > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', flexWrap: 'wrap', gap: '10px' }}>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              style={{ minWidth: '80px' }}
            >
              Previous
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>
              Month {Math.min((currentPage - 1) * itemsPerPage + 1, computedPoints.length)} – {Math.min(currentPage * itemsPerPage, computedPoints.length)} of {computedPoints.length}
            </span>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(computedPoints.length / itemsPerPage)))}
              disabled={currentPage === Math.ceil(computedPoints.length / itemsPerPage)}
              style={{ minWidth: '80px' }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Floating Detailed Breakdown Tooltip */}
      {hoveredCell && (
        <div 
          style={{
            position: 'fixed',
            left: `${hoveredCell.rect.left + hoveredCell.rect.width / 2}px`,
            top: `${hoveredCell.rect.top - 8}px`,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
            zIndex: 9999,
            minWidth: '320px',
            padding: '0.85rem 1rem',
            borderRadius: '10px',
            backgroundColor: 'var(--glass-bg)',
            backdropFilter: 'var(--glass-blur)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.85rem',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                {hoveredCell.type === 'assets' ? 'Assets Breakdown' : 'Liabilities Breakdown'}
              </span>
              <span style={{ fontStyle: 'italic', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Click cell to lock open breakdown modal
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '500', alignSelf: 'flex-start' }}>
              {formatMonthLabel(hoveredCell.date)}
            </span>
          </div>

          {/* List items (Scroll-free!) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {hoveredCell.items.length === 0 ? (
              <div style={{ padding: '0.5rem 0', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.75rem', textAlign: 'center' }}>
                No active {hoveredCell.type} accounts.
              </div>
            ) : (
              [...hoveredCell.items].sort((a, b) => b.balance - a.balance).map(item => {
                let changeColor = 'var(--text-muted)';
                let changeText = '$0.00';

                if (hoveredCell.isFirstMonth) {
                  changeColor = 'var(--text-muted)';
                  changeText = '--';
                } else {
                  if (hoveredCell.type === 'assets') {
                    if (item.change > 0) {
                      changeColor = 'var(--success)';
                      changeText = `+${formatCurrency(item.change)}`;
                    } else if (item.change < 0) {
                      changeColor = 'var(--danger)';
                      changeText = `-${formatCurrency(Math.abs(item.change))}`;
                    }
                  } else {
                    // For liabilities
                    if (item.change > 0) {
                      // liability went up (red/danger)
                      changeColor = 'var(--danger)';
                      changeText = `+${formatCurrency(item.change)}`;
                    } else if (item.change < 0) {
                      // liability went down (green/success)
                      changeColor = 'var(--success)';
                      changeText = `-${formatCurrency(Math.abs(item.change))}`;
                    }
                  }
                }

                return (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: '500', color: 'var(--text-main)', fontSize: '0.78rem', textAlign: 'left' }}>{item.name}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{item.bank}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '80px' }}>
                      <span style={{ fontWeight: '600', color: hoveredCell.type === 'assets' ? 'var(--success)' : 'var(--danger)', fontSize: '0.8rem' }}>
                        {formatCurrency(hoveredCell.type === 'liabilities' ? -item.balance : item.balance)}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: changeColor, fontWeight: '500' }}>
                        {hoveredCell.isFirstMonth ? '' : 'MoM: '}{changeText}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Spacious Breakdown Modal Overlay (Scroll-free!) */}
      {activeModalCell && (
        <div 
          className="split-drawer-overlay" 
          onClick={() => setActiveModalCell(null)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
        >
          <div 
            className="card" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              width: '500px', 
              maxWidth: '90%', 
              maxHeight: '90vh',
              backgroundColor: 'var(--bg-app)', 
              border: '1px solid var(--border-color)', 
              borderRadius: 'var(--radius-lg)', 
              padding: '2rem', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1.5rem',
              boxShadow: 'var(--shadow-lg)',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem' }}>
                  {activeModalCell.type === 'assets' ? 'Assets Breakdown' : 'Liabilities Breakdown'}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {formatMonthLabel(activeModalCell.date)}
                </span>
              </div>
              <button 
                onClick={() => setActiveModalCell(null)} 
                className="btn btn-secondary btn-sm" 
                style={{ padding: '6px', minHeight: 'auto' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* List items in Modal (Scrollable list if it exceeds display size) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '50vh', paddingRight: '6px' }}>
              {activeModalCell.items.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                  No active {activeModalCell.type} accounts.
                </div>
              ) : (
                [...activeModalCell.items].sort((a, b) => b.balance - a.balance).map(item => {
                  let changeColor = 'var(--text-muted)';
                  let changeText = '$0.00';

                  if (activeModalCell.isFirstMonth) {
                    changeColor = 'var(--text-muted)';
                    changeText = '--';
                  } else {
                    if (activeModalCell.type === 'assets') {
                      if (item.change > 0) {
                        changeColor = 'var(--success)';
                        changeText = `+${formatCurrency(item.change)}`;
                      } else if (item.change < 0) {
                        changeColor = 'var(--danger)';
                        changeText = `-${formatCurrency(Math.abs(item.change))}`;
                      }
                    } else {
                      if (item.change > 0) {
                        changeColor = 'var(--danger)';
                        changeText = `+${formatCurrency(item.change)}`;
                      } else if (item.change < 0) {
                        changeColor = 'var(--success)';
                        changeText = `-${formatCurrency(Math.abs(item.change))}`;
                      }
                    }
                  }

                  return (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem' }}>{item.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.bank}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '700', color: activeModalCell.type === 'assets' ? 'var(--success)' : 'var(--danger)', fontSize: '0.95rem' }}>
                          {formatCurrency(activeModalCell.type === 'liabilities' ? -item.balance : item.balance)}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: changeColor, fontWeight: '500' }}>
                          {activeModalCell.isFirstMonth ? '' : 'MoM: '}{changeText}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <button 
              onClick={() => setActiveModalCell(null)} 
              className="btn btn-secondary" 
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

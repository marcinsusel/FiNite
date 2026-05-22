import React, { useState } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpRight, 
  ArrowDownRight, Landmark, Briefcase, ChevronRight, BarChart3, AlertCircle 
} from 'lucide-react';

export default function NetWorth({ transactions, accounts }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

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
      result.push(`${y}-${mm}-01`);
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
    
    // Ensure we have at least the current month
    const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    if (result.length === 0 || !result.includes(currentMonthStr)) {
      if (!result.includes(currentMonthStr)) {
        result.push(currentMonthStr);
      }
    }
    return result;
  };

  const monthlyDates = getMonthlyDates(minDate);

  // 3. Compute balances for each month start
  const monthlyData = monthlyDates.map(D => {
    let assets = 0;
    let liabilities = 0;

    accounts.forEach(acc => {
      let balance = 0;
      if (acc.type === 'summary') {
        // Manual summary account balance as of D: most recent entry <= D
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
    });

    const netWorth = assets - liabilities;
    return {
      date: D,
      assets,
      liabilities,
      netWorth
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
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>Total Assets</span>
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
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>Total Liabilities</span>
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
              {/* Render list in descending chronological order for easier reading */}
              {[...computedPoints].reverse().map((pt, idx) => {
                const isPositiveChange = pt.change >= 0;
                const isFirstRow = pt.date === computedPoints[0].date;

                return (
                  <tr key={pt.date}>
                    <td style={{ fontWeight: '600' }}>{formatMonthLabel(pt.date)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: '500' }}>
                      {formatCurrency(pt.assets)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: '500' }}>
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
      </div>

    </div>
  );
}

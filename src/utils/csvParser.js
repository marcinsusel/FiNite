/**
 * Custom state-machine CSV parser that handles quotes, commas, escapes, and newlines correctly.
 */
export function parseCSV(text) {
  const result = [];
  let row = [];
  let inQuotes = false;
  let currentVal = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentVal.trim());
      if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
        result.push(row);
      }
      row = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  if (currentVal !== '' || row.length > 0) {
    row.push(currentVal.trim());
    result.push(row);
  }
  return result;
}

/**
 * Normalizes date format from MM/DD/YYYY to YYYY-MM-DD
 */
function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const m = parts[0].padStart(2, '0');
    const d = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

/**
 * Normalizes currency and amount strings to float values
 */
function normalizeAmount(amountStr) {
  if (typeof amountStr === 'number') return amountStr;
  if (!amountStr) return 0;
  // Remove spaces, dollar signs, and commas. Keep minus sign and decimals.
  const cleaned = amountStr.replace(/[\$\s,]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Auto-detects the format and parses CSV statement.
 * Returns { transactions: [...], error: null | string, bank: 'Chase' | 'Prosperity' | 'Unknown' }
 */
export function parseBankStatement(csvText) {
  try {
    const rawRows = parseCSV(csvText);
    if (rawRows.length < 2) {
      return { transactions: [], error: 'CSV file is empty or has no transaction rows', bank: 'Unknown' };
    }

    const headers = rawRows[0].map(h => h.toLowerCase().trim());
    let bank = 'Unknown';
    let transactions = [];

    // Chase detection
    // e.g. Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
    const isChase = headers.includes('posting date') && headers.includes('details') && headers.includes('type');

    // Prosperity detection
    // e.g. "Date","Description","Check Number","Amount","Balance","Order"
    const isProsperity = headers.includes('check number') && headers.includes('order');

    // Citi Bank detection
    // e.g. Status,Date,Description,Debit,Credit
    const isCiti = headers.includes('status') && headers.includes('debit') && headers.includes('credit') && headers.includes('description');

    if (isChase) {
      bank = 'Chase';
      const dateIdx = headers.indexOf('posting date');
      const descIdx = headers.indexOf('description');
      const amtIdx = headers.indexOf('amount');
      const checkIdx = headers.indexOf('check or slip #');

      // Loop through data rows (skip headers)
      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (row.length < Math.max(dateIdx, descIdx, amtIdx) + 1) continue;
        if (!row[dateIdx]) continue; // skip blank lines

        const date = normalizeDate(row[dateIdx]);
        const description = row[descIdx] || '';
        const amount = normalizeAmount(row[amtIdx]);
        const checkNumber = checkIdx !== -1 ? row[checkIdx] || '' : '';

        transactions.push({
          date,
          description,
          amount,
          checkNumber,
          bankType: 'Chase',
          rawLine: row.join(',')
        });
      }
    } else if (isProsperity) {
      bank = 'Prosperity';
      const dateIdx = headers.indexOf('date');
      const descIdx = headers.indexOf('description');
      const amtIdx = headers.indexOf('amount');
      const checkIdx = headers.indexOf('check number');

      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (row.length < Math.max(dateIdx, descIdx, amtIdx) + 1) continue;
        if (!row[dateIdx]) continue;

        const date = normalizeDate(row[dateIdx]);
        const description = row[descIdx] || '';
        const amount = normalizeAmount(row[amtIdx]);
        const checkNumber = checkIdx !== -1 ? row[checkIdx] || '' : '';

        transactions.push({
          date,
          description,
          amount,
          checkNumber,
          bankType: 'Prosperity',
          rawLine: row.join(',')
        });
      }
    } else if (isCiti) {
      bank = 'Citi';
      const dateIdx = headers.indexOf('date');
      const descIdx = headers.indexOf('description');
      const debitIdx = headers.indexOf('debit');
      const creditIdx = headers.indexOf('credit');

      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (row.length < Math.max(dateIdx, descIdx) + 1) continue;
        if (!row[dateIdx]) continue;

        const date = normalizeDate(row[dateIdx]);
        const description = row[descIdx] || '';
        
        let amount = 0;
        const debitVal = row[debitIdx];
        const creditVal = row[creditIdx];

        if (debitVal && debitVal.trim() !== '') {
          amount = -Math.abs(normalizeAmount(debitVal));
        } else if (creditVal && creditVal.trim() !== '') {
          amount = Math.abs(normalizeAmount(creditVal));
        }

        transactions.push({
          date,
          description,
          amount,
          checkNumber: '',
          bankType: 'Citi',
          rawLine: row.join(',')
        });
      }
    } else {
      // Fallback/Generic parser: Try to guess mapping based on standard names
      const dateIdx = headers.findIndex(h => h.includes('date'));
      const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('payee') || h.includes('name'));
      const amtIdx = headers.findIndex(h => h.includes('amt') || h.includes('amount') || h.includes('value'));
      
      if (dateIdx !== -1 && descIdx !== -1 && amtIdx !== -1) {
        bank = 'Generic';
        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (row.length < Math.max(dateIdx, descIdx, amtIdx) + 1) continue;
          if (!row[dateIdx]) continue;

          transactions.push({
            date: normalizeDate(row[dateIdx]),
            description: row[descIdx] || '',
            amount: normalizeAmount(row[amtIdx]),
            checkNumber: '',
            bankType: 'Generic',
            rawLine: row.join(',')
          });
        }
      } else {
        return { 
          transactions: [], 
          error: 'Could not identify bank CSV format. Headers found: ' + rawRows[0].join(', '),
          bank: 'Unknown' 
        };
      }
    }

    return { transactions, error: null, bank };
  } catch (err) {
    return { transactions: [], error: 'Failed parsing CSV: ' + err.message, bank: 'Unknown' };
  }
}

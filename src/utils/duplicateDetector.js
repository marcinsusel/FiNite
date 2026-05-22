/**
 * Generates a stable, deterministic ID for a transaction based on key details.
 * If the same row is imported, it will generate the same ID.
 */
export function generateTxId(tx, accountId) {
  const desc = (tx.description || '').trim().toLowerCase();
  // Format amount to 2 decimal places to prevent float representation differences
  const amt = Number(tx.amount || 0).toFixed(2);
  const date = tx.date || '';
  const key = `${date}|${amt}|${desc}|${accountId}`;

  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Add date prefix for easier sorting/filtering if raw ID is logged
  const dateStr = date.replace(/-/g, '');
  return `tx_${Math.abs(hash).toString(36)}_${dateStr}`;
}

/**
 * Checks if two descriptions are semantically similar.
 * Ignores casing, symbols, numbers, and checks for substring or word token overlaps.
 */
export function isSimilarDescription(desc1, desc2) {
  const clean = (str) => {
    return (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // remove punctuation
      .replace(/\b\d+\b/g, '')     // remove standalone numbers (like transaction IDs)
      .replace(/\s+/g, ' ')
      .trim();
  };

  const c1 = clean(desc1);
  const c2 = clean(desc2);
  if (!c1 || !c2) return false;

  // Substring check
  if (c1.includes(c2) || c2.includes(c1)) return true;

  // Token overlap check (for words > 2 characters)
  const tokens1 = c1.split(' ').filter(t => t.length > 2);
  const tokens2 = c2.split(' ').filter(t => t.length > 2);
  
  if (tokens1.length === 0 || tokens2.length === 0) return false;

  const set2 = new Set(tokens2);
  let matchCount = 0;
  for (const token of tokens1) {
    if (set2.has(token)) {
      matchCount++;
    }
  }

  const minLength = Math.min(tokens1.length, tokens2.length);
  const ratio = matchCount / minLength;
  return ratio >= 0.5; // 50% overlap of words
}

/**
 * Calculates day difference between two YYYY-MM-DD date strings.
 */
export function getDayDifference(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Runs duplicate check on parsed imports against the existing database.
 * 
 * Returns imports annotated with importStatus:
 * - 'new': No duplicate matches.
 * - 'exact': Same ID exists in database.
 * - 'fuzzy': Same account and amount, date within +/- 3 days, and description matches.
 * Returns: { transactions: [...imports with statuses], hasDuplicates: boolean }
 */
export function detectDuplicates(importedTxs, existingTxs, accountId) {
  let hasDuplicates = false;

  const annotated = importedTxs.map(newTx => {
    // Generate stable ID
    const txId = generateTxId(newTx, accountId);
    
    // 1. Exact match check
    const exactMatch = existingTxs.find(ext => ext.id === txId);
    if (exactMatch) {
      hasDuplicates = true;
      return {
        ...newTx,
        id: txId,
        accountId,
        importStatus: 'exact',
        matchedWith: exactMatch
      };
    }

    // 2. Fuzzy match check
    // Same account, same amount (exactly), date +/- 3 days, similar description
    const fuzzyMatch = existingTxs.find(ext => {
      if (ext.accountId !== accountId) return false;
      
      const amtDiff = Math.abs(ext.amount - newTx.amount);
      if (amtDiff > 0.001) return false;

      const dayDiff = getDayDifference(ext.date, newTx.date);
      if (dayDiff > 3) return false;

      return isSimilarDescription(ext.description, newTx.description);
    });

    if (fuzzyMatch) {
      hasDuplicates = true;
      return {
        ...newTx,
        id: txId,
        accountId,
        importStatus: 'fuzzy',
        matchedWith: fuzzyMatch
      };
    }

    // 3. Brand new transaction
    return {
      ...newTx,
      id: txId,
      accountId,
      importStatus: 'new'
    };
  });

  return { transactions: annotated, hasDuplicates };
}

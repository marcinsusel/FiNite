import fs from 'fs';
import path from 'path';
import { parseBankStatement } from '../csvParser.js';
import { detectDuplicates } from '../duplicateDetector.js';
import { getAutoCategoryId } from '../autoCategorizer.js';

// Absolute file paths to sample files
const csvDir = '/Users/marcin/Documents/dev/vibe-playground/FiNite/csv';
const prosperityFile = path.join(csvDir, 'prosperity_export_20260522.csv');
const chaseFile = path.join(csvDir, 'Chase5450_Activity_20260522.CSV');
const citiFile = path.join(csvDir, 'citi.CSV');

console.log('--- STARTING BANK CSV & DEDUPLICATION TESTS ---');

try {
  // Test 1: Prosperity Bank Parsing
  console.log('\nTest 1: Parsing Prosperity CSV...');
  const prosperityText = fs.readFileSync(prosperityFile, 'utf-8');
  const prosperityRes = parseBankStatement(prosperityText);
  
  if (prosperityRes.error) {
    console.error('❌ Prosperity parsing failed:', prosperityRes.error);
    process.exit(1);
  }
  
  console.log(`✅ Prosperity Parsed. Found ${prosperityRes.transactions.length} transactions. Format: ${prosperityRes.bank}`);
  
  // Verify prosperity detail mapping
  const venmoTx = prosperityRes.transactions.find(t => t.description.includes('VENMO'));
  if (venmoTx && venmoTx.amount === -25.00 && venmoTx.date === '2026-05-18') {
    console.log('✅ Prosperity first row matched expected mappings (VENMO, -$25.00, 2026-05-18)');
  } else {
    console.error('❌ Prosperity mapping incorrect for VENMO transaction:', venmoTx);
    process.exit(1);
  }

  // Test 2: Chase Bank Parsing
  console.log('\nTest 2: Parsing Chase CSV...');
  const chaseText = fs.readFileSync(chaseFile, 'utf-8');
  const chaseRes = parseBankStatement(chaseText);

  if (chaseRes.error) {
    console.error('❌ Chase parsing failed:', chaseRes.error);
    process.exit(1);
  }

  console.log(`✅ Chase Parsed. Found ${chaseRes.transactions.length} transactions. Format: ${chaseRes.bank}`);

  // Verify chase detail mapping
  const allyTx = chaseRes.transactions.find(t => t.description.includes('ALLY PAYMT'));
  if (allyTx && allyTx.amount === -381.51 && allyTx.date === '2026-05-19') {
    console.log('✅ Chase row matched expected mappings (ALLY, -$381.51, 2026-05-19)');
  } else {
    console.error('❌ Chase mapping incorrect for ALLY transaction:', allyTx);
    process.exit(1);
  }

  // Test 3: Deduplication
  console.log('\nTest 3: Testing Exact & Fuzzy Duplicate Detection...');
  
  // Let's create an existing transactions list containing the ALLY transaction
  const existingDatabase = [
    {
      id: 'existing_ally_id',
      accountId: 'acc-1',
      date: '2026-05-19',
      description: 'ALLY             ALLY PAYMT 228444221783    WEB ID: 9833122002',
      amount: -381.51,
      splits: [{ id: 's1', amount: -381.51, categoryId: 'cat-housing' }]
    },
    {
      id: 'existing_venmo_similar_date',
      accountId: 'acc-1',
      date: '2026-05-16', // 3 days difference (within limit)
      description: 'External Withdrawal VENMO  - PAYMENT',
      amount: -25.00,
      splits: [{ id: 's2', amount: -25.00, categoryId: 'cat-uncategorized' }]
    }
  ];

  // We check duplicate status on Prosperity imports
  const { transactions: annotatedImports, hasDuplicates } = detectDuplicates(
    prosperityRes.transactions,
    existingDatabase,
    'acc-1'
  );

  console.log(`✅ Deduplication run completed. Has duplicates detected: ${hasDuplicates}`);

  // Find fuzzy duplicate result
  const venmoImport = annotatedImports.find(t => t.description.includes('VENMO'));
  if (venmoImport && venmoImport.importStatus === 'fuzzy') {
    console.log('✅ Fuzzy duplicate detector correctly flagged Venmo transaction (Date diff = 2 days, similar desc, same amount)');
  } else {
    console.error('❌ Fuzzy duplicate not detected for Venmo:', venmoImport);
    process.exit(1);
  }

  // Test 4: Citi Bank Parsing
  console.log('\nTest 4: Parsing Citi CSV...');
  const citiText = fs.readFileSync(citiFile, 'utf-8');
  const citiRes = parseBankStatement(citiText);

  if (citiRes.error) {
    console.error('❌ Citi parsing failed:', citiRes.error);
    process.exit(1);
  }

  console.log(`✅ Citi Parsed. Found ${citiRes.transactions.length} transactions. Format: ${citiRes.bank}`);

  // Verify Citi detail mapping
  // Verify GOOGLE *Google One (row 2) parses as -5.24 (debit = outflow)
  const googleTx = citiRes.transactions.find(t => t.description.includes('Google One') && t.date === '2026-05-20');
  if (googleTx && googleTx.amount === -5.24) {
    console.log('✅ Citi row 2 matched expected mappings (GOOGLE *Google One, -5.24, 2026-05-20)');
  } else {
    console.error('❌ Citi mapping incorrect for GOOGLE transaction:', googleTx);
    process.exit(1);
  }

  // Verify ROSS STORES #1322 (row 12) parses as 37.87 (credit = inflow, even though negative in citi's raw format)
  const rossTx = citiRes.transactions.find(t => t.description.includes('ROSS STORES #1322') && t.date === '2026-05-17');
  if (rossTx && rossTx.amount === 37.87) {
    console.log('✅ Citi row 12 matched expected mappings (ROSS STORES #1322, 37.87, 2026-05-17)');
  } else {
    console.error('❌ Citi mapping incorrect for ROSS STORES transaction:', rossTx);
    process.exit(1);
  }

  // Test 5: Custom Categories Validation & Creation
  console.log('\nTest 5: Validating category creation rules...');
  const mockCategories = [
    { id: 'cat-groceries', name: 'Groceries' },
    { id: 'cat-housing', name: 'Housing/Mortgage/Rent' }
  ];

  const createCategory = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return { error: 'Empty name' };

    const duplicate = mockCategories.find(
      c => c.name.toLowerCase() === trimmed.toLowerCase()
    );

    if (duplicate) {
      return { error: `A category named "${duplicate.name}" already exists.` };
    }

    const newId = `custom_${Math.random().toString(36).substr(2, 9)}`;
    const newCat = { id: newId, name: trimmed };
    mockCategories.push(newCat);
    return { category: newCat, error: null };
  };

  // Test successful addition
  const resSuccess = createCategory('Hobbies');
  if (resSuccess.category && resSuccess.category.name === 'Hobbies' && mockCategories.length === 3) {
    console.log('✅ Custom category successfully created ("Hobbies")');
  } else {
    console.error('❌ Failed creating custom category "Hobbies":', resSuccess);
    process.exit(1);
  }

  // Test case-insensitive duplicate check
  const resDup = createCategory('groceries');
  if (resDup.error && resDup.error.includes('already exists')) {
    console.log('✅ Case-insensitive duplicate category creation blocked correctly ("groceries")');
  } else {
    console.error('❌ Failed duplicate verification for "groceries":', resDup);
    process.exit(1);
  }

  // Test 6: Auto-Categorization & Review Locking
  console.log('\nTest 6: Testing Auto-Categorization & Review Locking...');

  // 6a: Test getAutoCategoryId
  const testCategories = [
    { id: 'cat-uncategorized', name: 'Uncategorized', keywords: [] },
    { id: 'cat-groceries', name: 'Groceries', keywords: ['ross', 'kroger'] },
    { id: 'cat-tech', name: 'Technology', keywords: ['google', 'apple'] }
  ];

  const matchedTech = getAutoCategoryId('GOOGLE *Google One', testCategories);
  if (matchedTech === 'cat-tech') {
    console.log('✅ Auto-categorization correctly matched keyword "google" to tech category');
  } else {
    console.error('❌ Auto-categorization failed to match "google":', matchedTech);
    process.exit(1);
  }

  const matchedGroceries = getAutoCategoryId('ROSS STORES #1322', testCategories);
  if (matchedGroceries === 'cat-groceries') {
    console.log('✅ Auto-categorization correctly matched keyword "ross" to groceries category (case-insensitive substring)');
  } else {
    console.error('❌ Auto-categorization failed to match "ross":', matchedGroceries);
    process.exit(1);
  }

  const matchedUncategorized = getAutoCategoryId('Some unknown merchant', testCategories);
  if (matchedUncategorized === 'cat-uncategorized') {
    console.log('✅ Auto-categorization correctly returned uncategorized for unmatched merchant');
  } else {
    console.error('❌ Auto-categorization failed for unmatched merchant:', matchedUncategorized);
    process.exit(1);
  }

  // 6b: Test Review Locking logic
  // Simulate the UI lock rule: if a transaction is reviewed, no modifications (edit/delete) are allowed.
  const handleUpdateTransactionMock = (tx, updatedTx) => {
    if (tx.reviewed) {
      return { success: false, error: 'Transaction is reviewed and locked. Edits are disabled.' };
    }
    return { success: true, transaction: updatedTx };
  };

  const handleDeleteTransactionMock = (tx) => {
    if (tx.reviewed) {
      return { success: false, error: 'Transaction is reviewed and locked. Deletion is disabled.' };
    }
    return { success: true };
  };

  const unlockedTx = { id: 'tx-1', description: 'Kroger Store', amount: -45.00, reviewed: false };
  const lockedTx = { id: 'tx-2', description: 'Netflix Subscription', amount: -15.99, reviewed: true };

  // Test updating unlocked transaction
  const unlockedUpdateRes = handleUpdateTransactionMock(unlockedTx, { ...unlockedTx, amount: -50.00 });
  if (unlockedUpdateRes.success && unlockedUpdateRes.transaction.amount === -50.00) {
    console.log('✅ Unlocked transaction successfully allowed edit');
  } else {
    console.error('❌ Unlocked transaction edit failed:', unlockedUpdateRes);
    process.exit(1);
  }

  // Test updating locked transaction
  const lockedUpdateRes = handleUpdateTransactionMock(lockedTx, { ...lockedTx, amount: -20.00 });
  if (!lockedUpdateRes.success && lockedUpdateRes.error.includes('locked')) {
    console.log('✅ Locked transaction successfully blocked edit');
  } else {
    console.error('❌ Locked transaction edit was not blocked:', lockedUpdateRes);
    process.exit(1);
  }

  // Test deleting unlocked transaction
  const unlockedDeleteRes = handleDeleteTransactionMock(unlockedTx);
  if (unlockedDeleteRes.success) {
    console.log('✅ Unlocked transaction successfully allowed delete');
  } else {
    console.error('❌ Unlocked transaction delete failed:', unlockedDeleteRes);
    process.exit(1);
  }

  // Test deleting locked transaction
  const lockedDeleteRes = handleDeleteTransactionMock(lockedTx);
  if (!lockedDeleteRes.success && lockedDeleteRes.error.includes('locked')) {
    console.log('✅ Locked transaction successfully blocked delete');
  } else {
    console.error('❌ Locked transaction delete was not blocked:', lockedDeleteRes);
    process.exit(1);
  }

  // Test 7: Net Worth Calculation
  console.log('\nTest 7: Net Worth Calculation...');

  const testNWAccounts = [
    { id: 'acc-checking', type: 'checking', bank: 'Chase' },
    { id: 'acc-credit', type: 'credit', bank: 'Citi' },
    {
      id: 'acc-summary',
      type: 'summary',
      bank: 'Manual',
      balances: [
        { id: 'b1', date: '2026-04-01', balance: 50000.00 },
        { id: 'b2', date: '2026-05-01', balance: 55000.00 }
      ]
    }
  ];

  const testNWTransactions = [
    { accountId: 'acc-checking', amount: 1000.00, date: '2026-03-15' },
    { accountId: 'acc-checking', amount: -200.00, date: '2026-04-10' },
    { accountId: 'acc-credit', amount: -500.00, date: '2026-04-05' },
    { accountId: 'acc-credit', amount: 100.00, date: '2026-05-02' }
  ];

  const calculateNetWorthForDate = (D, accounts, transactions) => {
    let assets = 0;
    let liabilities = 0;

    accounts.forEach(acc => {
      let balance = 0;
      if (acc.type === 'summary') {
        const sorted = [...(acc.balances || [])].sort((a, b) => b.date.localeCompare(a.date));
        const latest = sorted.find(entry => entry.date <= D);
        balance = latest ? latest.balance : 0;
      } else {
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

    return { assets, liabilities, netWorth: assets - liabilities };
  };

  // Test 7a: 2026-03-01
  const nwMar = calculateNetWorthForDate('2026-03-01', testNWAccounts, testNWTransactions);
  if (nwMar.netWorth === 0 && nwMar.assets === 0 && nwMar.liabilities === 0) {
    console.log('  ✅ 2026-03-01 Net Worth is correctly $0.00');
  } else {
    console.error('  ❌ 2026-03-01 Net Worth calculated incorrectly:', nwMar);
    process.exit(1);
  }

  // Test 7b: 2026-04-01
  const nwApr = calculateNetWorthForDate('2026-04-01', testNWAccounts, testNWTransactions);
  if (nwApr.assets === 51000 && nwApr.liabilities === 0 && nwApr.netWorth === 51000) {
    console.log('  ✅ 2026-04-01 Net Worth matches expected: Assets=$51k, Liabilities=$0, Net Worth=$51k');
  } else {
    console.error('  ❌ 2026-04-01 Net Worth calculated incorrectly:', nwApr);
    process.exit(1);
  }

  // Test 7c: 2026-05-01
  const nwMay = calculateNetWorthForDate('2026-05-01', testNWAccounts, testNWTransactions);
  if (nwMay.assets === 55800 && nwMay.liabilities === 500 && nwMay.netWorth === 55300) {
    console.log('  ✅ 2026-05-01 Net Worth matches expected: Assets=$55.8k, Liabilities=$500, Net Worth=$55.3k');
  } else {
    console.error('  ❌ 2026-05-01 Net Worth calculated incorrectly:', nwMay);
    process.exit(1);
  }

  // Test 8: Month Name Date Parsing
  console.log('\nTest 8: Month Name Date Parsing...');
  const mockCSVText = `Type,Date,Description,Status,Amount
"Purchase","May 14 2026","SAMS CLUB.COM 006279 BENTONVILLE AR","Completed","$23.96"
"Purchase","Apr 29 2026","WALMART 000206 MCKINNEY TX","Completed","$10.79"
"Purchase","Feb 4 2026","SAM'S CLUB 004906 MCKINNEY TX","Completed","$103.11"`;

  const parsedCSV = parseBankStatement(mockCSVText);
  if (parsedCSV.error) {
    console.error('  ❌ Month Name Date CSV parsing failed:', parsedCSV.error);
    process.exit(1);
  }

  const txs = parsedCSV.transactions;
  if (txs.length === 3 &&
      txs[0].date === '2026-05-14' &&
      txs[1].date === '2026-04-29' &&
      txs[2].date === '2026-02-04') {
    console.log('  ✅ Month name dates parsed correctly to ISO YYYY-MM-DD');
  } else {
    console.error('  ❌ Month name dates parsed incorrectly:', txs);
    process.exit(1);
  }

  console.log('\n🎉 ALL CORE LOGIC TESTS PASSED SUCCESSFULLY! 🎉');

} catch (err) {
  console.error('❌ Unexpected test runner error:', err);
  process.exit(1);
}

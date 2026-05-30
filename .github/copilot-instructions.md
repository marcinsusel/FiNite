# GitHub Copilot Instructions for FiNite

This document provides context and rules for GitHub Copilot to ensure generated code suggestions adhere to FiNite's technology stack, architecture, and premium design patterns.

## Technology Stack & Design System
* **Framework**: React.js inside a Vite-powered build pipeline.
* **Styling**: Vanilla CSS only (defined in `src/index.css`). **Never use TailwindCSS**.
* **Theme**: Glassmorphism, harmonious HSL variables (`var(--primary)`, `var(--success)`, `var(--danger)`), active state chevrons, and smooth pointer scales.

## Key Modules & Patterns
* **Transaction Database**: Transactions, splits, categories, and accounts are managed in a central state within `App.jsx` and persisted locally or to Google Drive.
* **Stable Identifiers**: Transaction IDs use chronological occurrence suffixes (e.g. `_0`, `_1`) to support identical daily statement records.
* **Net Worth Evaluations**: Evaluated as of the **end of each month** (`YYYY-MM-DD`) to include all activity within month boundaries and match current ledger lists.
* **Reconciliation Rules**: Reconciliation entries use `'OPENING BALANCE BY FINITE'` and are locked against deletion in the ledger, with all amount values rounded to exactly two decimal places.

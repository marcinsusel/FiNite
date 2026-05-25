# 🪙 FiNite - Bank Transaction Aggregator & Net Worth Tracker

**FiNite** is a modern, privacy-first, locally-cached personal finance aggregator and net worth tracker. Designed with premium visual aesthetics and premium user experience in mind, it allows you to consolidate your bank statements, categorize transactions (including multi-way splits), manage manual and automated accounts, and visualize your wealth over time—all while keeping 100% control of your financial data.

---

## 🌟 Key Features

### 🔒 100% Private & Privacy-First Architecture
*   **Zero Database Servers:** FiNite runs entirely in your web browser. No external databases, middleman servers, or third-party analytical trackers can see your financial details.
*   **Dual-Storage Mode:**
    *   **Local Mode:** Instantly saves all accounts, transactions, and categories locally inside the browser's `LocalStorage`.
    *   **Cloud Synced:** Integrated with **Google Identity Services (GIS)** for secure, automated two-way synchronization to your personal Google Drive account. It creates a private `FiNite/appData.json` file on your Drive using OAuth2 scopes restricted to files created by the application itself (`drive.file`).

### 📂 Multi-Format Bank Statement Parser
*   Import CSV statements directly from major financial institutions:
    *   **Chase Bank** (Detects Posting Date, Description, Amount, Check/Slip #)
    *   **Prosperity Bank** (Detects Date, Description, Amount, Check Number, Order)
    *   **Citi Card** (Detects Date, Description, Status, Debit, Credit)
    *   **Generic Fallback Parser** (Automatically scans headers for date, amount, payee, and description columns to support custom bank formats).

### 🧙‍♂️ Intelligent Duplicate Resolution Wizard
*   During CSV imports, FiNite runs a state-of-the-art deduplication algorithm.
*   It generates stable, deterministic transactional hashes based on date, amount, description, and target account.
*   Flags potential duplicate conflicts using both **Exact Matches** and **Fuzzy Matches** (same amount, account, date within $\pm3$ days, and semantically overlapping descriptions).
*   A beautiful step-by-step resolution dashboard empowers you to **Skip** imports, **Import Anyway** (as duplicates), or **Overwrite** existing records (resets splits).

### ✂️ Split Transactions & Custom Categorization
*   **Multi-Category Allocation:** Allocate single transactions into multiple distinct categories (splits), each with custom amounts and individual notes.
*   **Keyword-Based Auto-Categorization:** Define custom categories and assign search keywords. With a single click, automatically process your transaction log and categorize pending rows based on descriptions.
*   **Inline Editing:** Add categories on the fly, change splits in a slide-out drawer, and customize notes with zero friction.

### 📈 Manual & Transaction-Based Ledger Accounts
*   **Transaction Accounts:** Populate checking, savings, or credit card balances dynamically by importing statement CSV files.
*   **Manual Summary Accounts:** Track non-transactional assets/liabilities (such as investment portfolios, loans, real estate, precious metals, or cash) by entering manual balance points over time.

### 📊 Interactive Wealth Accumulation Analytics
*   **Net Worth Trend Chart:** Custom interactive SVG line graph mapping assets, liabilities, and cumulative net worth. Includes vertical grid lines, focal focus lines, and glassmorphic detail cards on hover.
*   **Historical Ledger:** A complete, scrollable chronological breakdown of monthly net worth with interactive details drawers displaying individual asset and liability accounts, as well as Month-over-Month (MoM) performance and percentages.
*   **Category Spending:** Dynamic horizontal progress bars detailing spending by category for chosen months, showing percentages and amounts.

---

## 🎨 Design System & Aesthetics

FiNite features a state-of-the-art design language engineered with pure vanilla CSS:

*   **Harmony of Colors:** Seamless transition between dark and light themes using CSS variables with curated HSL color tokens.
    *   **Brand Primary:** Sleek blend of blurple/indigo (`hsl(240, 75%, 60%)`).
    *   **Inflows / Assets:** Vibrant emerald green (`hsl(145, 80%, 42%)`).
    *   **Outflows / Expenses:** Crimson red (`hsl(355, 85%, 55%)`).
*   **Premium Typography:** Elegant dual-font configuration. Headings are stylized with the geometric **Outfit** font for modern tech appeal, while the body and tabular data use highly-legible **Inter**.
*   **Glassmorphic Details:** Semi-transparent glass container overlays (`backdrop-filter: blur(16px)`), modern subtle borders (`rgba(255,255,255,0.08)`), and deep soft box shadows (`var(--shadow-lg)`).
*   **Micro-Animations:** Fluid transitions for hover elements, pulse effects for active cloud synchronization processes, and smooth sidebar drawer sliders for transactional splits.

---

## 📂 Project Structure

```
FiNite/
├── .github/                # Workflows for continuous delivery / GitHub Pages deployment
├── csv/                    # Sample spreadsheets or input data logs
├── src/
│   ├── components/
│   │   ├── AccountManager.jsx     # Handles creation and manual balance records for accounts
│   │   ├── CategoryManager.jsx    # Configures categories and automatic keyword rules
│   │   ├── Dashboard.jsx          # Summarizes monthly inflows, outflows, and category spending
│   │   ├── DuplicateWizard.jsx    # Step-by-step import resolution wizard for CSV conflicts
│   │   ├── NetWorth.jsx           # SVG trend chart and historical balance breakdown ledger
│   │   ├── Settings.jsx           # Google Drive OAuth integration configurations
│   │   └── TransactionList.jsx    # Comprehensive logs filter, search, editing, and splits drawer
│   ├── utils/
│   │   ├── autoCategorizer.js     # Keyword matching engine
│   │   ├── csvParser.js           # Custom state-machine CSV parser and date normalizer
│   │   ├── duplicateDetector.js   # Hash-based exact/fuzzy deduplication system
│   │   └── googleDriveHelper.js   # OAuth2 and direct Google Drive API REST clients
│   ├── App.jsx             # Root layout, router view switcher, and global state coordinator
│   ├── index.css           # Core premium design system, color tokens, and layout styles
│   └── main.jsx            # React application entry point
├── index.html              # HTML shell & Google API GIS script imports
├── package.json            # Vite & React dependency manifests
└── vite.config.js          # Vite build environment configuration
```

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation
1. Clone the repository to your local computer:
   ```bash
   git clone <repository-url>
   cd FiNite
   ```
2. Install the package dependencies:
   ```bash
   npm install
   ```

### Running Locally
To launch the Vite development server locally, execute:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your web browser to access the application.

### Building for Production
To bundle the assets for static web hosting:
```bash
npm run build
```
This generates the optimized, production-ready static assets in the `dist` directory.

---

## 📖 How to Use

### Step 1: Set Up Your Accounts
1. Go to the **Bank Accounts** tab on the sidebar.
2. Select your account type: **Checking**, **Savings**, **Credit Card**, or **Summary Account (Manual)**.
3. For statement-supported accounts, choose your Bank format mapping (e.g. *Chase*, *Prosperity*, *Citi*, or *Generic*).
4. For manual accounts (like investments), open the **Balances** drawer and log your historical account balances.

### Step 2: Import Transaction Statements
1. Go to the **Import Statement** tab.
2. Select your target bank account.
3. Click the upload dropzone, select your CSV statement file, and upload.
4. If there are duplicates or overlapping conflicts, the **Duplicate Wizard** will load. Review each card side-by-side, decide whether to **Skip**, **Import Anyway**, or **Overwrite**, then click **Apply Imports**.

### Step 3: Manage Categories & Split Transactions
1. Go to the **Categories** tab to manage categories. Add search keywords (e.g. `walmart` for *Groceries*, `landlord` for *Housing*) and click **Apply Auto-Categorization** to process uncategorized records.
2. Go to the **Transactions Log** tab. Click **Split** on any row to open the sliding splits panel. Allocate the transaction amount across multiple categories, add separate notes, and click **Save Splits**.

### Step 4: Configure Google Drive Sync (Optional)
1. Go to the Google Cloud Console and set up an OAuth2 Client ID with the **Google Drive API** enabled. Set your redirect/origin URIs to your local or hosted domain (e.g. `http://localhost:5173`).
2. Navigate to the **Settings** view in FiNite.
3. Enter your **Google Client ID** and click **Connect Google Drive**.
4. Log in via the official Google Identity Services popup and authorize file creation access.
5. Your data will now automatically sync to your private Google Drive space, and load securely when you open the application on another device!

---

## 🛠️ Built With

*   **Vite** - High-speed frontend tooling and bundler.
*   **React** - Component-based user interface architecture.
*   **Lucide React** - Minimalist, modern iconography.
*   **Google Identity Services & Google Drive API** - Serverless, secure personal cloud storage sync.
*   **Vanilla CSS** - Fully customized, ultra-performant styling system.

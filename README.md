# SASSC Hybrid FMCG Credit Management Application

This repository contains the SASSC Hybrid FMCG Credit Management System, a specialized financial technology and debt-control platform tailored for South African Social Services Association (SASSA) grant recipients and retail micro-credit operations. The application is built as a highly secure, offline-first React and TypeScript single-page application integrated with Google Firebase (Firestore and Authentication) to facilitate secure synchronization, financial ledgering, compliance auditing, and legal document rendering.

---

## System Overview & Architecture

The SASSC Credit Management Application is designed as a hybrid fintech solution to streamline high-velocity retail transaction capture (POS), credit appraisal underwriting, dynamic portfolio tracking, and debt recovery. It uses a robust, dual-storage model that preserves complete operational capabilities during network degradation while maintaining single-source-of-truth accuracy in the cloud.

### High-Density Functional Modules

1. **Dashboard Command Center**: Offers aggregate statistical snapshots including gross exposure, active accounts, overdue counts, rolling collections, collections success ratios, and integrated cash drawer reconciliations.
2. **Point of Sale (POS) and Cash Register**: Enables cash and credit inventory-backed sale checkouts. Integrates real-time verification checks that dynamically query active client outstanding balances to block unauthorized credit checkouts.
3. **Credit Wizard Underwriting Suite**: Guides credit consultants through national credit regulatory compliance workflows (NCA compliance). Includes salary/grant verification, expense analysis, automated bank account linking simulations, affordability scorecard evaluations, and direct credit underwriting.
4. **Active Agreements Ledger**: Manages active credit agreements, amortization schedules, monthly service fee tracking, initiate fees, and interest parameters.
5. **Customer Dossier Center**: Manages customer profiles, National Credit Regulator (NCR) compliant documentation, financial ledgers, and communication touchpoints.
6. **Collection Operations & WhatsApp Sync**: Tracks delinquent accounts, handles debt collection logs, and integrates a dual-route WhatsApp communication backup. This module supports direct cell number routing or automated failover to verified Next of Kin (NOK) WhatsApp routes when primary numbers do not have active WhatsApp accounts.
7. **Cash Control and Reconciliations**: Restricts checkout operations to active cash days. Operators are required to declare opening floats, register mid-day cash-up actions, and perform close-of-day balances.
8. **Audit and Override Console**: Automatically captures operational events requiring administrative overrides (e.g. override limits, custom credit limits, manual fee waiving) with required PIN authorization and cryptographic traceability.

---

## Data Flow

The platform utilizes a structured, reactive state and event pipeline to ensure strict precision in financial math, data replication, and local durability.

### 1. Client-Side Presentation and State Layer
All data structures are kept in unified React memory lists. Users manipulate data inside modular views (e.g., POS checkout, underwriter scorecard wizard). All currency math is processed in **Integer Cents** (South African Cents) rather than double-precision floats to guarantee zero rounding errors.

### 2. Micro-Storage Local Replication (Local Storage Database)
Every localized state change is instantly serialized and written into local browser database arrays (`localStorage` partitions for customers, agreements, sales, payments, collection_notes, cash_control, system_configs, and whatsapp_logs). This guarantees complete offline resilience if the terminal disconnects.

### 3. Bidirectional Asynchronous Cloud Synchronization
A dedicated database synchronization background runner handles reconciliation with Google Firebase. 
* **Fetch Phase**: On platform load or manual click, the system pulls updated server state from Cloud Firestore. If collisions exist, local state merges or is overwritten by the remote system values based on strict timestamp sequencing.
* **Commit Phase**: Action updates (e.g., a new agreement registered, payment processed) perform transaction-style sets to specified firestore document references.
* **Security Layer Interception**: The `firestoreService` layer intercepts queries to log detailed error envelopes if Cloud Firestore security constraints reject transactions.

### 4. Legal Compliance and Printing Engine
Operational records (e.g. Tax Invoices, Acknowledgement of Debt agreements, Affordability Scorecard declarations, Salary Deduction Mandates) are compiled and exported using dynamic HTML document generators. These compile clean, standardized CSS structures designed for thermal POS receipt printers or administrative A4 document systems.

---

## Firebase Services in Use

The platform leverages serverless Firebase infrastructure to deliver bank-grade security and distributed state coordination.

### 1. Cloud Firestore
The primary operational document database. Firestore hosts individual documents organized across several critical collections, optimized with declarative access controls:
* `customers`: Profile details, employment/grant parameters, identity numbers, and next-of-kin contacts.
* `agreements`: Core micro-loans, grocery credit lines, outstanding balances, amortization tracks, and status fields.
* `sales`: Audit records of items disbursed and transactional metadata.
* `payments`: Itemized history of cash, grant, and bank EFT repayment events.
* `collection_notes`: Administrative diary of customer contact attempts, pledges, and arrears updates.
* `whatsapp_logs`: History of formal notifications, legal warnings, and statements sent to primary or next-of-kin routes.
* `cashDays`: Cash register management sessions tracking cashier balances and manual cash movement logs.
* `system_configs`: Centralized parameters for initiation fees, interest limits, and override authentication PIN configurations.

### 2. Firebase Authentication (Auth)
Secures entry to the application, authenticates operators, checks authorization permissions, and audits manual override logs. Custom security claims route operators into distinct operational clearance tiers:
* `cashier_operator`: Restricted to POS operations, float entries, and client directory lookups. Cannot approve agreements or override defaults.
* `credit_underwriter`: Authorized to complete financial appraisals and generate credit agreements.
* `main_admin` / `supervisor`: Grants unrestricted access, reporting analysis, schema parameter adjustments, and override authorizations.

### 3. Firestore Security Rules
Enforces data isolation, data structural validations, and identity-linked read/write authorization. These rules prevent client manipulation or unauthorized cross-tenant exposure of sensitive credit data.

---

## Setup Steps

To initialize and run this application locally or in a staging environment, execute the following instructions.

### Prerequisites
* **Node.js**: Ensure Node.js (version 18 or higher) is installed.
* **Firebase Project**: Create a Google Firebase Project via the Firebase Console.
* **Firestore Database**: Initialize Firestore in Native Mode in your Firebase console.

### 1. Clone & Install Dependencies
Navigate to the root directory of the application and run the installation script:
```bash
npm install
```

### 2. Configure Firebase Environment Config
Create or edit the `firebase-applet-config.json` file in the root directory to populate your unique Firebase API configuration details:
```json
{
  "projectId": "your-firebase-project-id",
  "appId": "your-firebase-app-id",
  "apiKey": "your-firebase-api-key",
  "authDomain": "your-firebase-project-id.firebaseapp.com",
  "firestoreDatabaseId": "default",
  "storageBucket": "your-firebase-project-id.firebasestorage.app",
  "messagingSenderId": "your-sender-id"
}
```

### 3. Configure Local Environment Variables
Create a `.env` file in the project root to control development or runtime overrides (modeled after `.env.example`):
```env
GEMINI_API_KEY="your-optional-gemini-ai-key"
APP_URL="http://localhost:3000"
```

### 4. Build and Compile the Application
Verify syntax validity, TypeScript compilation, and linting rules prior to server boot or standalone executable packaging:
```bash
# Run linter checks
npm run lint

# Build production assets (outputs to /dist folder)
npm run build
```

### 5. Start the Development Server
Launch the local Node.js server binding to the default port of `3000`:
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000` to verify live operations.

---

## Environment Variables Directory

The following environment parameters are used to configure features across integration services:

| Variable Name | Required | Scope / Target | Description |
| :--- | :---: | :--- | :--- |
| `GEMINI_API_KEY` | Optional | Server-side | API credentials used for AI-driven portfolio profiling, financial risk analytics, and client communication formatting. |
| `APP_URL` | Required | Application Runtime | Defines the base URL where the application is hosted. Used for constructing dynamic self-referential links, print references, and document previews. |

---

## Security, IP Protection, & Design Standards

* **Principle of Least Privilege**: Access to Firestore collections is regulated through custom claims. Only validated supervisors can commit schema parameter modifications or bypass payment blocks.
* **Input Sanitization**: Client inputs, specifically ID numbers, cell numbers, and banking details, are parsed and sanitized using strict regular expressions prior to processing or local storage serialization.
* **Integer Arithmetic for Ledger Integrity**: Standard floating-point precision issues are completely eliminated. All ledgers, invoice tallies, fee tracking parameters, and payments are stored and manipulated as integers representing cents (e.g. `10000` represents R100.00).
* **Minimalist High-Density UI**: Built using an optimized, high-contrast Slate design theme. Employs generous negative space, clear typographic hierarchy with "Space Grotesk" displays paired with "Inter" UI and "JetBrains Mono" tabular readouts. Displays zero structural margin noise, log outputs, or non-functional status telemetry.

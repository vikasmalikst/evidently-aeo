
# V2 Report Generation Documentation

This document outlines the implementation and usage of the Version 2 (V2) PDF and Email Report Generators for Executive Reporting.

## Overview

The V2 report generation system provides high-fidelity replication of the Executive Reporting UI (`/executive-reporting`). 

- **PDF Generation**: Uses Puppeteer to navigate to the actual frontend UI and print it to PDF.
- **Email Generation**: Captures a screenshot of the UI to embed in the email body (ensuring visual consistency) and attaches the generated PDF.

## Components

### 1. PDF Export Service V2
**File**: `backend/src/services/executive-reporting/pdf-export-v2.service.ts`

**Key Features**:
- **Headless Browser**: Uses Puppeteer to launch a Chrome instance.
- **Auth Bypass**: Automatically injects a developer session (`localStorage`) to bypass login screens during generation.
- **Context Injection**: Sets the selected Brand ID via `localStorage` and URL parameters to ensure the correct data is loaded immediately.
- **Smart Waiting**: Waits for the metrics grid and network idle state to ensure charts are fully rendered before printing.

**Usage**:
```typescript
import { pdfExportServiceV2 } from './pdf-export-v2.service';

const pdfBuffer = await pdfExportServiceV2.generatePDF(reportId, brandId);
```

### 2. Email Service V2
**File**: `backend/src/services/email/email-v2.service.ts`

**Key Features**:
- **Visual Fidelity**: Embeds a high-quality screenshot of the report in the email body using CID embedding.
- **Attachments**: Automatically attaches the full PDF report.
- **Templating**: Uses a clean HTML wrapper around the screenshot.

**Usage**:
```typescript
import { emailServiceV2 } from './email-v2.service';

await emailServiceV2.sendExecutiveReport(
  'recipient@example.com',
  reportId,
  brandId,
  brandName
);
```

## Frontend Requirements

The V2 generator relies on the frontend being accessible at `http://localhost:5173`.
To support specific brand loading, the frontend hook `useManualBrandDashboard` has been modified to accept a `brandId` URL parameter.

**URL Format Used**:
`http://localhost:5173/executive-reporting?brandId={brandId}&reportId={reportId}&printMode=true`

## Setup & Dependencies

1.  **Puppeteer**: Ensure `puppeteer` is installed in the backend.
    ```bash
    cd backend
    npm install puppeteer
    ```
    (Note: It requires Chromium dependencies on Linux/Docker environments).

2.  **Frontend**: The frontend development server must be running.
    ```bash
    npm run dev
    ```

3.  **Environment Variables**:
    - `ZOHO_MAIL_USER`: For sending emails.
    - `ZOHO_MAIL_PASSWORD`: App password for Zoho Mail.

## Testing

A test script is provided to verify the functionality:

```bash
npx ts-node backend/scripts/test-v2-report.ts
```

This script will:
1.  Fetch a random brand and its latest report from the database.
2.  Generate a PDF and save it as `backend/scripts/test-report-[BrandName].pdf`.
3.  Attempt to send an email to the test address.

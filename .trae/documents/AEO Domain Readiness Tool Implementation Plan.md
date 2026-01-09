# Implementation Plan: AEO Domain Readiness Tool (Standalone Module)

I have refined the plan to ensure **strict isolation** and **zero impact** on existing functionality. All new code will be encapsulated in dedicated directories.

## Phase 1: Backend (Self-Contained Module)

### 1. Dedicated Directory
All backend logic will reside in `backend/src/services/domain-readiness/`.
- **No changes** to existing `BrandService` or other core services.
- This module will handle its own database queries (read-only for brands, write for audits).

### 2. Database
- Create a new migration for `domain_readiness_audits` table.
- This table is independent and only references `brands(id)` as a foreign key.

### 3. Implementation Details (`backend/src/services/domain-readiness/`)
- `analyzers/`: Directory containing the 13 pure function analyzers.
- `types.ts`: Local type definitions.
- `domain-readiness.service.ts`: The orchestrator service.
- `domain-readiness.controller.ts`: Handles HTTP requests.
- `routes.ts`: Defines the API routes for this feature.

### 4. Integration
- **Only one touchpoint**: Register the new routes in `backend/src/app.ts` under a new path (e.g., `/api/domain-readiness`).

## Phase 2: Frontend (Self-Contained Page)

### 1. Dedicated Directory
All frontend logic will reside in `src/pages/DomainReadiness/`.
- `components/`: Local components (ScoreGauge, Breakdown, etc.) specific to this page.
- `hooks/`: Local data fetching hooks.
- `types/`: Local TypeScript interfaces.
- `DomainReadinessPage.tsx`: The main entry point.

### 2. Integration
- **Minimal changes**:
    - Add one route `/domain-readiness` in `src/App.tsx`.
    - Add one menu item in `src/components/Layout/Sidebar.tsx`.

## Phase 3: Verification
- Verify that the new feature works independently.
- specific check to ensure no regression in existing brand dashboard or onboarding flows.

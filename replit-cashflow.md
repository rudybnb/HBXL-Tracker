# ERdesignandbuild-Cashflow - GPS Time Tracking & Cash Flow Management System

## Overview
ERdesignandbuild-Cashflow is a duplicate version of the main ERdesignandbuild application with enhanced cash flow management capabilities. This version maintains all existing GPS-based time tracking, job management, and contractor features while adding comprehensive project cash flow tracking, expense management, and financial forecasting tools.

## User Preferences
Preferred communication style: Simple, everyday language.
App Recreation Method: User prefers to provide visual references (screenshots/pictures) showing color schemes, layouts, and functionality rather than detailed written descriptions.
**CRITICAL USER CONCERN**: Maintaining data integrity and preventing loss of working features.

**Purpose**: This is a duplicate environment to safely test and develop cash flow features without affecting the working main system.

## System Architecture

### Cash Flow Enhancement
The cashflow version includes all original features plus:

**New Cash Flow Tables**:
- `project_cash_flow`: Weekly cash flow tracking per project
- `cash_flow_forecasts`: Future cash flow projections
- `cash_flow_alerts`: Automated alerts for negative flows, overdue payments
- `expenses`: Material, equipment, and subcontractor cost tracking
- `client_payments`: Invoice and payment tracking with retention management

**Enhanced Work Sessions**:
- Hourly rate tracking
- Gross pay calculation
- CIS deduction computation
- Net pay calculation
- Job ID linkage for cost attribution

**Enhanced Jobs Table**:
- Estimated budget tracking
- Actual cost monitoring
- Profit margin calculation
- Client payment status
- Payment amount tracking

### Technical Implementation
**Database**: Uses separate `DATABASE_URL_CASHFLOW` environment variable or falls back to main `DATABASE_URL`
**Schema**: Located in `shared-cashflow/schema.ts` with enhanced cash flow tables
**Server**: Runs from `server-cashflow/` directory on separate port
**Client**: Located in `client-cashflow/` with cash flow UI components

### UI/UX Decisions
Maintains the original dark navy background (`#1e293b`) with muted yellow-grey headers and text (`#d97706`, `#ca8a04`). Cash flow components will use additional color coding:
- Green for positive cash flow
- Red for negative cash flow  
- Orange for alerts and warnings
- Blue for forecasts and projections

### Core Features (Inherited)
All original features from the main system:
- GPS Security & Validation
- Permanent Database Work Session Tracking
- Weekend Overtime Admin Control
- Location-Aware Job Detection
- Contractor Onboarding
- Admin Management
- Authentication
- Admin Site Reporting Interface
- CSV Upload Functionality
- Automatic Pay Calculation
- CSV Data Supremacy Enforcement
- Admin Site Reporting System
- Progressive Inspection System
- Contractor Issue Resolution Workflow
- Full Automation System
- Contractor Telegram Mapping

### New Cash Flow Features
**Weekly Cash Flow Tracking**:
- Income tracking (client payments, retention release, variations)
- Expense categorization (labor, materials, equipment, overheads)
- Net cash flow calculation
- Cumulative cash flow monitoring

**Financial Forecasting**:
- Future cash flow projections
- Confidence level indicators
- Scenario planning capabilities

**Expense Management**:
- Detailed expense categorization
- Supplier tracking
- Invoice management
- Payment status monitoring
- Receipt upload functionality

**Client Payment Tracking**:
- Invoice generation and tracking
- Payment scheduling
- Retention management
- Overdue payment alerts
- Days past due calculation

**Automated Alerts**:
- Negative cash flow warnings
- Payment overdue notifications
- Budget exceeded alerts
- Critical threshold monitoring

## External Dependencies
Same as original system plus potential additions for:
- Chart.js or Recharts for cash flow visualizations
- PDF generation for financial reports
- Excel export capabilities for cash flow data

## Development Guidelines
- Maintain data integrity supremacy rules
- Use authentic database data only
- Preserve all working features from original system
- Add cash flow features incrementally
- Test in isolation before integration
- Document all changes in this file

## File Structure
```
/
├── client-cashflow/          # Duplicate frontend with cash flow features
├── server-cashflow/          # Duplicate backend with cash flow APIs
├── shared-cashflow/          # Enhanced schema with cash flow tables
├── package-cashflow.json     # Separate package configuration
├── drizzle-cashflow.config.ts # Separate database configuration
└── replit-cashflow.md        # This documentation file
```

## Development Status
- ✓ Created duplicate project structure
- ✓ Enhanced database schema with cash flow tables
- ✓ Configured separate package and drizzle files
- 🚧 Server-side cash flow API endpoints (in progress)
- ⏳ Client-side cash flow UI components (pending)
- ⏳ Cash flow dashboard integration (pending)
- ⏳ Financial reporting features (pending)

## Recent Changes
**August 15, 2025**:
- Created complete duplicate of ERdesignandbuild system
- Added enhanced schema with cash flow management tables
- Set up separate configuration files for isolated development
- Maintained all original functionality while preparing for cash flow integration
# ERdesignandbuild - GPS Time Tracking & Job Management System

## Overview
ERdesignandbuild is a GPS-based time tracking and job management application for contractors. It offers GPS-verified time tracking, file upload for job creation, comprehensive admin dashboards, and direct job assignment. The system aims to enhance efficiency, ensure accurate record-keeping, and provide a robust solution for managing contractor operations, including time tracking, compliance, job assignment, and progress monitoring.

## User Preferences
Preferred communication style: Simple, everyday language.
App Recreation Method: User prefers to provide visual references (screenshots/pictures) showing color schemes, layouts, and functionality rather than detailed written descriptions. Visual specifications are more effective for accurate app recreation.
**CRITICAL USER CONCERN**: User losing confidence in Replit due to data loss and having to redo completed work. Priority: Ensure 100% data persistence and prevent any regression of working features.

**MANDATORY DEVELOPMENT RULES - ZERO TOLERANCE FOR DATA LOSS**: When making ANY changes to the system:
- **Rule 1: NEVER REWRITE WORKING CODE** - Only modify broken or non-functional parts, make incremental changes only
- **Rule 2: DATA INTEGRITY** - All data must come from authentic database sources, never use static/mock data
- **Rule 3: CSV DATA SUPREMACY** - When a job is uploaded via CSV, ONLY information in that CSV file must be used. NO assumptions, fallbacks, or old stored data permitted. If CSV data missing, display "Data Missing from CSV" rather than assumptions.
- **Rule 4: ZERO REGRESSION POLICY** - Before ANY code changes, verify current functionality works and test after changes
- **Rule 5: PERSISTENT DATA VERIFICATION** - Always verify database data exists and is accessible before claiming features work
- **Rule 6: USER CONFIDENCE PROTECTION** - Document all fixes permanently and ensure they persist across sessions
- **Rule 7: LOCKED CSV PARSING** - The CSV parsing logic in both frontend and backend is now locked down with regex to remove trailing commas. DO NOT MODIFY the parsing sections marked "LOCKED DOWN" or "NEVER CHANGE THIS"
- **Rule 8: LIVE DATA ONLY** - System now uses live production data exclusively. No temporary, test, or placeholder data permitted. All backup information must be correct and retained.
- **Rule 9: AUTOMATION SUPREMACY** - All systems must work automatically without manual intervention. Manual time fixes, Telegram ID setup, or data corrections are prohibited.
- **Rule 10: LOCATION DISPLAY ACCURACY** - Work sessions must display meaningful location names (like "Chatham, ME5 9GX") instead of GPS coordinates for accounting purposes. System automatically maps GPS data to proper job locations.
- Always verify what is currently working before making changes
- These rules are mandatory and must be followed at all times to prevent regression and data corruption

## System Architecture

### UI/UX Decisions
The application uses a dark navy background (`#1e293b`) with muted yellow-grey headers/text (`#d97706`, `#ca8a04`). UI elements feature rounded cards with slate borders (`#374151`) and consistent bottom navigation. The live clock monitoring is on a dedicated page (`/live-clock-monitor`) with simplified layout and real-time activity display.

### Technical Implementations
**Frontend**: React with TypeScript, Vite, Shadcn/ui components on Radix UI, Tailwind CSS, TanStack React Query, Wouter for routing, and React Hook Form with Zod validation.
**Backend**: 
- **Node.js Express** (Port 5000): Main application server with TypeScript (ES modules), RESTful API (JSON), Multer for CSV uploads, and Twilio voice integration.
- **Python FastAPI** (Port 8000): Telegram Bot API service with 6 endpoints for worker queries, hours tracking, payments, and subcontractor management. Runs on `app.py` with uvicorn, requires manual workflow start ("Start Python API" workflow using `./start-python-api.sh`).
**Database**: PostgreSQL with Drizzle ORM (Node.js) and asyncpg connection pool (Python). Schema includes `work_sessions`, `admin_settings`, `contractors`, `jobs`, `csv_uploads`, `contractor_reports`, `contractor_applications`, and `admin_inspections`. Zod schemas provide type-safe validation.

**Core Features**:
- **GPS Security**: 1km proximity validation, enforced working hours, automatic logout, GPS coordinate extraction from postcodes, and real-time GPS tracking with in-memory location tracking and status indicators.
- **Time Tracking**: Permanent database `work_sessions` tracking, automatic pay calculation with punctuality deductions and CIS deduction, and authentic database rates.
- **Job Management**: CSV upload with preview, location-aware job detection, multi-site detection for Active Assignment, and CSV data supremacy enforcement.
- **Admin & Contractor Management**: Admin dashboards for contractor review, CIS management, pay rate administration, and contractor onboarding. Role-based interfaces with dynamic authentication and flexible name matching.
- **Reporting & Inspections**: Admin site reporting interface with photo uploads and assessments. Progressive inspection system with notifications at 50% and 100% job completion. Contractor issue resolution workflow.
- **Automation**: Full Telegram integration for automatic ID capture and job notifications, server-side 5 PM auto-logout, and automatic contractor Telegram mapping.
- **Telegram Bot API (Python FastAPI)**: Dedicated REST API for Telegram bot integration with 6 endpoints:
  - `/api/telegram/worker-type/{chat_id}` - Get worker type (day-rate vs sub-contractor)
  - `/api/telegram/hours/{chat_id}` - Get total hours worked this week
  - `/api/telegram/payments/{chat_id}` - Get payment history and status
  - `/api/telegram/subcontractor/quotes/{chat_id}` - Get active quotes
  - `/api/telegram/subcontractor/milestones/{chat_id}` - Get milestone progress
  - `/api/telegram/subcontractor/payment-status/{chat_id}` - Get payment status
- **AI Voice Assistant**: Twilio phone-based voice assistant with OpenAI GPT-4o-mini and ElevenLabs TTS (Bella voice). Supports app database queries (contractor hours, jobs, inspections, pay rates) and general knowledge, with admin-only access and multi-app integration for financial data.
- **Financial Features**: Integration with an external Financeflow app (pound-wise-rudybnbd.replit.app) for real-time financial data (bank balance, debt, net worth, overdue card alerts) via the voice assistant. Account-specific cashflow system for project data filtering.
- **Jobs Assigned Dashboard**: Dedicated "Jobs Assigned" section for specific contractors (e.g., Dalwayne) with comprehensive oversight of assignments, deadlines, and project status.
- **Data Integrity**: Critical fixes implemented to ensure authentic database times, correct login credentials, accurate pay rates, and cleanup of duplicate sessions. Export functionality for CSV has been fully disabled on the backend.

### System Design Choices
The application provides a complete workflow with distinct role-based interfaces, managing operations from CSV upload and job creation to contractor assignment and progress monitoring. Architectural decisions prioritize data persistence (PostgreSQL), security (GPS validation), and user experience. The system is designed for a multi-contractor architecture with dynamic authentication, flexible name matching, scalable assignment, and complete data separation.

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL.
- **Drizzle ORM**: Type-safe database operations.

### Cloud Storage
- **Google Cloud Storage**: For file storage.

### UI and Styling Libraries
- **Radix UI**: Component primitives.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.

### Development Tools
- **Vite**: Build tool and development server.
- **ESBuild**: Fast JavaScript bundler.
- **TypeScript**: For type safety.

### AI and Voice Services
- **OpenAI GPT-4o-mini**: For intelligent query processing in the voice assistant.
- **ElevenLabs**: Text-to-speech synthesis (Bella voice).
- **Twilio**: For phone-based voice assistant integration.

### Python Dependencies
- **FastAPI**: Telegram Bot API framework
- **asyncpg**: Async PostgreSQL client for Python
- **fastapi-cors**: CORS middleware
- **uvicorn**: ASGI server for Python apps
- **httpx**: Async HTTP client
- **aiofiles**: Async file I/O
- **python-dotenv**: Environment variable management

### Financial Integration
- **Financeflow app (pound-wise-rudybnbd.replit.app)**: Provides real-time financial data.
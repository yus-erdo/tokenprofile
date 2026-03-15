# Milestone 8 — Data & Privacy

**Priority:** 🟠 High
**Effort:** Small
**Dependencies:** None (standalone, but should ship before Teams)

## Goal

Give users control over their data — retention, export, and deletion. GDPR-aligned.

## Features

### 8.1 Data Retention Controls
Auto-delete data older than a user-defined period.

- [ ] Settings UI: retention period selector
  - Options: 30 days, 90 days, 1 year, 2 years, Forever (default)
- [ ] Store in user document: `dataRetention: { period: string, updatedAt: Timestamp }`
- [ ] Scheduled cleanup function (Firebase Cloud Function or cron)
  - Runs daily, deletes events older than retention period per user
  - Batch deletes to avoid timeout (500 docs per batch)
- [ ] Confirmation dialog when changing retention period
  - "This will delete X events older than [date]. This cannot be undone."
- [ ] Show current data range in settings: "Your data spans from [date] to [date]"

### 8.2 Export & Delete (GDPR)
Full data portability and account deletion.

- [ ] Export all data button (reuse M6 export endpoint with `all` range)
  - Includes: profile data, all events, settings, badges
  - Format: JSON archive
  - Single ZIP download with structured files
- [ ] Account deletion flow:
  1. User clicks "Delete Account"
  2. Confirmation dialog with username re-type
  3. Show what will be deleted: profile, events, API keys, notifications
  4. 7-day grace period (soft delete → hard delete)
  5. Send confirmation email (when email is available)
- [ ] Soft delete: set `deletedAt` timestamp, stop serving profile
- [ ] Hard delete (after grace period):
  - Delete all events (batch)
  - Delete all notifications
  - Delete user document
  - Revoke OAuth session
- [ ] API endpoint: `POST /api/users/me/delete` (initiates deletion)
- [ ] API endpoint: `POST /api/users/me/cancel-deletion` (during grace period)

## Technical Notes

- Data retention cleanup needs a scheduled function — Firebase Cloud Functions or a cron endpoint
- For soft delete: filter out `deletedAt` users in all public queries
- ZIP export: use `JSZip` or stream a tar archive
- Account deletion is sensitive — log all deletion events for audit
- Grace period state: add `deletedAt` and `deletionScheduledFor` fields to user doc
- During grace period, user can still log in and cancel

## Definition of Done

- Retention controls work and auto-cleanup runs reliably
- Full data export downloads a complete archive
- Account deletion has working grace period with cancel option
- Deleted accounts are fully cleaned up after grace period
- All flows have clear confirmation dialogs

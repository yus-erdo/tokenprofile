# Milestone 7 — Budgets & Alerts

**Priority:** 🟡 Medium
**Effort:** Medium
**Dependencies:** M1 (analytics data for threshold comparison)

## Goal

Help users stay aware of their spending and usage patterns with budgets and alerts.

## Features

### 7.1 Token Budget
Set spending/usage limits and get warnings.

- [ ] Budget settings UI:
  - Budget type: token count or USD cost
  - Period: daily, weekly, monthly
  - Amount: user-defined threshold
  - Warning threshold: percentage (e.g., warn at 80%)
- [ ] Store in user document: `budget: { type, period, amount, warningPercent }`
- [ ] Budget progress indicator on dashboard
  - Progress bar showing current usage vs budget
  - Color changes: green → yellow (warning) → red (exceeded)
- [ ] In-app notification when warning threshold crossed
- [ ] In-app notification when budget exceeded
- [ ] Budget history: track whether budget was met each period

### 7.2 Spike Alerts
Notify when usage is abnormally high compared to patterns.

- [ ] Calculate baseline: rolling 7-day average of daily usage
- [ ] Spike detection: current day exceeds 2x the rolling average
- [ ] In-app alert banner: "Your usage today is 3.2x your average"
- [ ] Alert appears on dashboard, dismissible
- [ ] Store alert preferences: `alerts: { spikesEnabled: boolean, spikeMultiplier: number }`

### 7.3 In-App Notification System
Foundation for delivering alerts within the app.

- [ ] Notification bell icon in nav bar with unread count badge
- [ ] Notification dropdown/panel showing recent notifications
- [ ] Notification types: budget_warning, budget_exceeded, spike_alert, badge_unlocked
- [ ] Mark as read / mark all as read
- [ ] Store notifications in Firestore: `notifications/{notificationId}`
  - `userId`, `type`, `title`, `message`, `read`, `createdAt`, `metadata`
- [ ] Real-time updates via Firestore listener
- [ ] Auto-cleanup: delete notifications older than 30 days

### 7.4 Email Notifications (Future-Ready)
Prepare the notification system for email delivery.

- [ ] Abstract notification delivery behind a `notify(userId, notification)` function
- [ ] Email delivery adapter interface (implement later with Resend/SendGrid)
- [ ] User preferences: per-notification-type delivery channel (in-app, email, both)
- [ ] Store email preferences in user document

## Technical Notes

- Budget evaluation happens on each ingest event (check in `/api/ingest`)
- Spike detection can run as part of the ingest flow or on profile load
- Notifications collection needs Firestore security rules
- In-app notification UI: dropdown panel from nav bell icon
- Keep notification payloads small — link to details rather than embedding data
- Email adapter: design the interface now, implement when keys are available

## Definition of Done

- Users can set and modify budgets
- Budget progress displays accurately on dashboard
- Spike detection works correctly against rolling averages
- Notification bell shows unread count
- Notifications appear in real-time
- Email adapter interface defined (implementation deferred)

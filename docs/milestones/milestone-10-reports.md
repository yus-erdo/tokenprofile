# Milestone 10 — Reports

**Priority:** 🟢 Low
**Effort:** Medium
**Dependencies:** M1 (analytics data), M7 (notification system)

## Goal

Auto-generated periodic reports summarizing usage — in-app first, email later.

## Features

### 10.1 Monthly Report Generation
Auto-generate a monthly usage summary.

- [ ] Report data model: `reports/{reportId}`
  ```
  {
    userId: string
    period: string ("2026-03")
    type: "monthly"
    data: {
      totalTokens: number
      totalCost: number
      completionCount: number
      activeDays: number
      topModel: string
      topProject: string
      peakDay: { date: string, tokens: number }
      streakInfo: { current: number, longest: number }
      modelBreakdown: { model: string, tokens: number, cost: number }[]
      dailyActivity: { date: string, tokens: number }[]
      comparisonVsPrevious: { tokens: number, cost: number, completions: number } // % change
    }
    generatedAt: Timestamp
  }
  ```
- [ ] Report generation function (Firebase Cloud Function or cron)
  - Runs on 1st of each month for the previous month
  - Aggregates all events for the user in that month
  - Stores report document
- [ ] Trigger in-app notification when report is ready

### 10.2 In-App Report Viewer
Beautiful report page with stats and charts.

- [ ] Report page: `/reports/{period}` or modal view
- [ ] Sections:
  - Summary header: "Your March 2026 Report"
  - Key metrics: tokens, cost, completions, active days
  - Comparison vs previous month (up/down arrows with percentages)
  - Daily activity mini-heatmap for the month
  - Model breakdown chart
  - Top projects list
  - Highlights: peak day, longest streak, most used model
- [ ] Report archive: list of all past reports
- [ ] Share report link (public, optional)

### 10.3 Email Report Delivery
Send report via email when email service is configured.

- [ ] Email template: clean HTML email with key stats
  - Should render well in major email clients
  - Include CTA link to full in-app report
- [ ] Delivery via Resend/SendGrid (adapter from M7)
- [ ] User preference: opt-in/out of email reports
- [ ] Unsubscribe link in email footer

### 10.4 Weekly Digest (Optional)
Shorter weekly summary for users who want more frequent updates.

- [ ] Same structure as monthly but for the past 7 days
- [ ] User preference: weekly digest on/off
- [ ] Lighter weight — fewer sections, key metrics only
- [ ] Delivered in-app + email (if enabled)

## Technical Notes

- Report generation is a batch job — needs scheduled execution
- Firebase Cloud Functions (scheduled) or a Vercel cron endpoint
- Reports are pre-computed and stored — not generated on-demand
- Email templates: use React Email or MJML for responsive emails
- Keep report documents reasonably sized (flatten aggregations)
- Historical reports: generate retroactively for past months on first enable

## Definition of Done

- Monthly reports generate automatically on schedule
- In-app report viewer displays all sections with charts
- Reports are accurate against raw event data
- Email delivery works when email service is configured
- Users can opt in/out of email reports

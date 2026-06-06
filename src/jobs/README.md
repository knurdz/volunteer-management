# Background Job Patterns

This repo does not include a production scheduler yet. The files in this folder
are safe, importable job functions that Sadeepa can later wire to cron,
Appwrite Functions, or another trusted serverless runner.

- `sendUnreadNotificationDigestJob` scans unread in-app notifications and can
  send a digest through the notification email adapter.
- `sendEventReminderNotificationsJob` is a placeholder pattern for event
  reminders. A future event module should provide the canonical recipient list.

Both jobs default to `dryRun: true`. A trusted runner should pass
`dryRun: false` only after environment variables and notification email delivery
are configured. No secrets are required or committed here.

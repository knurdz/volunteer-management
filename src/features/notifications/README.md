# Notifications

Browser users can only read and mark their own notifications through:

- `GET /api/notifications`
- `POST /api/notifications/mark-read`

`POST /api/notifications` is reserved for trusted server/job callers. It is
disabled unless `INTERNAL_JOB_TOKEN` is configured. Trusted callers must send the
token in `x-internal-job-token` or as a bearer token. Do not expose this token to
browser code.

Notification email delivery is adapter-backed and disabled unless
`NOTIFICATION_EMAILS_ENABLED=true` plus SMTP settings are configured. The default
disabled adapter records only safe delivery intent.

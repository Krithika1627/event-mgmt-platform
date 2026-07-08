# Event Management Platform — Azure Functions

This project contains the notification Azure Functions for the Event Management Platform.

## Functions

| Function | Trigger | Purpose |
|---|---|---|
| `registrationNotification` | HTTP POST | Sends registration confirmation email. Called by backend after a successful registration. |
| `eventUpdateNotification` | HTTP POST | Sends event update emails to all active registrants. Called by backend when an organizer sends an update. |
| `eventReminder` | Timer (hourly) | Sends reminder emails to attendees whose events start within the next 24 hours. |

## Prerequisites

- [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local) (v4+)
- Node.js 18+
- Cosmos DB account (shared with the backend)
- SMTP server credentials for sending emails

## Local Development

1. Copy `local.settings.example.json` to `local.settings.json` and fill in all values.

2. Install dependencies:

```bash
npm install
```

3. Start the Functions host:

```bash
func start
```

The functions will be available at:
- `http://localhost:7071/api/registrationNotification`
- `http://localhost:7071/api/eventUpdateNotification`
- Timer trigger runs automatically on the configured schedule (hourly for demo).

## Environment Variables

| Variable | Description |
|---|---|
| `COSMOS_CONNECTION_STRING` | Cosmos DB connection string (same as backend) |
| `COSMOS_DATABASE_NAME` | Cosmos DB database name |
| `COSMOS_USERS_CONTAINER` | Users container name |
| `COSMOS_EVENTS_CONTAINER` | Events container name |
| `COSMOS_REGISTRATIONS_CONTAINER` | Registrations container name |
| `COSMOS_NOTIFICATIONS_CONTAINER` | Notifications container name |
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (default: 587) |
| `SMTP_SECURE` | Use TLS (true/false) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `EMAIL_FROM` | From address for outgoing emails |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | (Optional) Application Insights connection string |

## Deployment

Deploy to Azure Function App:

```bash
func azure functionapp publish <your-function-app-name>
```

Set application settings in the Azure Portal or via Azure CLI:

```bash
az functionapp config appsettings set --name <app-name> --resource-group <rg> --settings \
  COSMOS_CONNECTION_STRING="..." \
  COSMOS_DATABASE_NAME="..." \
  ... (all other env vars)
```

## Known Limitations

- **Stale PENDING notifications**: If the Function invocation or network call fails, notification documents may remain in `PENDING` status indefinitely. A background cleanup job or retry mechanism is outside this MVP scope.
- **Sequential email sending**: `eventUpdateNotification` sends emails one at a time. At scale, consider parallel sending or a queue-based approach.
- **Concurrent Cosmos access**: The Functions use the same Cosmos DB containers as the backend, with no built-in locking.

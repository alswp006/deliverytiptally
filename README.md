# DeliveryTipTally — Delivery Tip Tracker

A mini-app for tracking delivery orders and tips across Korean food delivery platforms. Record food orders, track spending patterns, set monthly goals, and discover savings opportunities by choosing pickup instead of delivery.

Available exclusively in the Toss mobile app. Built with Vite + React for optimal performance and accessibility in the Toss ecosystem.

## Features

- 📝 **Record Orders** — Log delivery orders with food amount, tip, and optional padding from Baemin, Coupang Eats, Yogiyo, and others
- 💰 **Monthly Goals** — Set and track monthly delivery tip targets with visual progress indicators
- 📊 **Analytics & Reports** — View monthly summaries by platform, trends, and potential savings
- 🏪 **Pickup Savings** — Identify orders where pickup was available to calculate delivery costs avoided
- 🎯 **Data Export & Sharing** — Share summaries and insights within the Toss app
- 🌓 **Dark Mode** — Full dark mode support with TDS design system integration

## Tech Stack

- **Frontend** — React 18, TypeScript, Vite
- **Routing** — React Router DOM
- **Design System** — Toss Design System (TDS), Emotion CSS-in-JS
- **Icons** — Lucide React
- **Storage** — Browser localStorage (App-in-Toss native storage available)
- **State Management** — React hooks (useState, useReducer)
- **Testing** — Vitest, Playwright visual tests

## Getting Started

### Installation

```bash
npm install
```

### Building

```bash
# Production build
npm run build

# Verify build
npm run gate

# For Toss deployment
npx ait build
```

### Running Tests

```bash
# Unit & integration tests
npx vitest run

# Visual regression tests
npm run test:visual

# Type checking
npm run typecheck
```

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `VITE_TOSS_AD_GROUP_ID` | Toss banner ad group ID from console | Optional (hides banner if empty) |
| `VITE_TOSS_AD_SLOT_ID` | Toss reward ad slot ID from console | Optional |
| `VITE_SHARE_OG_URL` | Open Graph image URL for app sharing | Optional |

Copy `.env.example` to `.env` and populate with values from the [Toss Developer Console](https://console.tossmini.com).

## Project Structure

```
src/
  pages/           # Screen components (Home, OrderNew, OrderList, etc.)
  components/      # Reusable TDS-based components (Card, SummaryHero, SubmitFooter)
  lib/
    storage/       # localStorage CRUD, validation, monthly summaries
    format.ts      # Number, currency, date formatting
    analytics.ts   # Instrumentation (screen events, clicks, impressions)
    types.ts       # Shared TypeScript types (DeliveryOrder, AppSettings)
    date.ts        # KST date utilities
  __tests__/       # Unit and integration tests
e2e/               # Visual regression tests (Playwright)
```

## Deployment

### For Toss Mini App Platform

1. **Build** — `npm run build` generates a static CSR bundle
2. **Register** — Register the app in [Toss Developer Console](https://console.tossmini.com) and obtain an app ID
3. **Configure** — Update `apps-in-toss.config.ts` with the registered app name (case-sensitive)
4. **Deploy** — Run `npx ait build` and submit via the console review flow

The app runs on Toss CDN with origins:
- Production: `https://{appName}.web.tossmini.com`
- QA/Testing: `https://{appName}.private-web.tossmini.com`

### Prerequisites

- Android 7+ or iOS 16+
- Toss app installed
- No external API calls (all data stored locally)

## License

MIT

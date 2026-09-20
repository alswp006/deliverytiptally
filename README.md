🇺🇸 [한국어](./README.ko.md)

# DeliveryTipTally — Track delivery tips and order spending

DeliveryTipTally is a mini-app for the Toss ecosystem that helps users track delivery food orders, tips, and spending across Korean delivery platforms. Users can record orders, monitor monthly tip goals, and view analytics on spending patterns and savings opportunities.

## Features

- 📝 **Order Recording** — Log delivery orders with platform, food amount, delivery tip, and minimum order padding
- 💰 **Spending Tracking** — Monthly summary showing total tips, food costs, and added padding costs
- 🎯 **Goal Management** — Set monthly tip spending goals and receive notifications when goals are exceeded
- 📊 **Analytics & Reports** — View monthly trends with sparkline charts, platform breakdowns, and savings estimates
- 💾 **Local Storage** — All order data persists locally on device (no server required)
- 📱 **Multi-Tab Navigation** — Four-tab interface (Home, Orders, Report, Settings) with persistent state
- 🌙 **Dark Mode** — Full dark mode support via TDS design system
- 📢 **In-App Ads** — Banner and reward ads (optional, configurable via environment variables)
- ✨ **Haptic Feedback** — Native haptic feedback on interactions
- 📈 **Event Tracking** — Built-in analytics for key user actions

## Tech Stack

- **Frontend:** Vite, React 18, TypeScript
- **Routing:** React Router 7
- **UI Components:** @toss/tds-mobile (Toss Design System)
- **SDK:** @apps-in-toss/web-framework
- **Styling:** Emotion, CSS variables (dark mode)
- **Icons:** Lucide React
- **Testing:** Vitest, Playwright
- **Build:** Vite (CSR/SSG only, no SSR)

## Getting Started

### Install dependencies
```bash
npm install
```

### Typecheck
```bash
npx tsc --noEmit
```

### Run tests
```bash
npx vitest run              # Unit tests
npm run test:visual         # Visual regression tests (Playwright)
```

### Build for production
```bash
npx vite build              # Standard Vite build
npx ait build               # Apps-in-Toss (Toss CDN) bundle
```

The standard build outputs to `dist/` for local testing. The Apps-in-Toss (`ait`) build prepares the app for deployment to the Toss mini-app platform and requires `npx ait deploy` (managed via Toss developer console).

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SHARE_OG_URL` | Open Graph image URL for shared links (social preview) | No |
| `VITE_TOSS_AD_SLOT_ID` | Toss console reward ad slot ID (unlocks monthly report) | No |
| `VITE_TOSS_AD_GROUP_ID` | Toss console banner ad group ID (home/orders/savings screens) | No |
| `VITE_TOSS_IAP_SKU` | In-app purchase SKU (reserved, not used in MVP) | No |
| `VITE_TOSS_PROMOTION_CODE` | Promotion code for user rewards (reserved, not used in MVP) | No |

Create a `.env` file from `.env.example` and fill in values from the Toss developer console. If values are empty, features degrade gracefully (e.g., no ads shown, link sharing works without preview).

## Project Structure

```
src/
├── pages/                      # Screen components
│   ├── Home.tsx               # Dashboard with current month summary
│   ├── OrderNew.tsx           # Create new order
│   ├── OrderList.tsx          # List and search orders
│   ├── OrderEdit.tsx          # Edit/delete existing order
│   ├── Savings.tsx            # Savings estimates and platform analysis
│   ├── Report.tsx             # Monthly analytics (reward-ad gated)
│   └── GoalSettings.tsx       # Monthly tip goal configuration
├── components/                 # Pre-built UI components
│   ├── ScreenScaffold.tsx     # Page layout wrapper
│   ├── SummaryHero.tsx        # Large headline number display
│   ├── Card.tsx               # Content card container
│   ├── Amount.tsx             # Formatted currency display
│   ├── FloatingTabBar.tsx     # 4-tab navigation
│   ├── StateView.tsx          # Empty/loading states
│   ├── Sparkline.tsx          # Trend sparkline chart
│   ├── MiniBar.tsx            # Inline progress bar
│   ├── AdSlot.tsx             # Banner ad wrapper
│   └── TossRewardAd.tsx       # Reward ad gate component
├── lib/                        # Utilities and business logic
│   ├── storage/               # LocalStorage helpers with error handling
│   ├── analytics.ts           # Event tracking (clicks, impressions)
│   ├── summary.ts             # Monthly summary calculations
│   ├── date.ts                # Date utilities (YYYY-MM-DD, YYYY-MM keys)
│   ├── format.ts              # Formatting helpers (KRW, percent, dates)
│   ├── types.ts               # Domain types and constants
│   └── review.ts              # App review request
├── __tests__/                  # Unit and integration tests
├── App.tsx                     # Route definitions
└── main.tsx                    # React root (anchored, do not modify)
```

## Deployment

### Local Testing
```bash
npm run build
npx vite preview     # Serve production build locally
```

### Toss Mini-App Deployment
1. Build for Apps-in-Toss:
   ```bash
   npx ait build
   ```
2. Configure `apps-in-toss.config.ts`:
   - Verify `appName` matches Toss console registration (case-sensitive)
   - Set `brand.primaryColor` to your Toss brand color
3. Use the Toss developer console to:
   - Upload the build artifact
   - Configure ad slot/group IDs and environment variables
   - Trigger review and deployment to Toss CDN

The app is deployed to `https://<appName>.web.tossmini.com` (production) and `https://<appName>.private-web.tossmini.com` (QR test).

## Code Standards

- **TDS Components Only:** All UI uses Toss Design System (`@toss/tds-mobile`). No custom CSS frameworks.
- **No External APIs:** All data stored in browser localStorage. No server required.
- **Error Handling:** Storage failures, SDK calls, and share operations use try/catch guards (never throw to console in production).
- **Analytics:** Built-in event tracking for key conversions; no external analytics tools (GA, Amplitude, etc.).
- **Haptic & Accessibility:** Native SDK haptic feedback on CTAs; all touch targets ≥44px.
- **Dark Mode:** Colors via `var(--tds-color-*)` CSS variables; no hardcoded HEX values.

## License

MIT

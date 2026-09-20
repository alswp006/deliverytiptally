# DeliveryTipTally

앱인토스 (Vite + React + TDS) 이번 달 배달팁으로만 얼마 냈는지 아세요? 주문 한 번 적을 때마다 쌓이는 배달비 누적 계산기 배달앱을 쓰면 배달팁과 최소주문금액 채우기 때문에 지출이 커지지만, 월 합계를 확인하기 어렵다.

## Tech Stack

- React 18.0.0
- TypeScript
- Vitest

## Routes

| Path | Description |
|------|-------------|
| `/GoalSettings` | GoalSettings |
| `/Home` | Home |
| `/OrderEdit` | OrderEdit |
| `/OrderList` | OrderList |
| `/OrderNew` | OrderNew |
| `/Report` | Report |
| `/Savings` | Savings |

## Getting Started

```bash
pnpm install
pnpm dev
```

## Development

```bash
pnpm typecheck    # Type checking
pnpm test         # Run tests
pnpm build        # Production build
```

## Design Documents

See `.ai-factory/` directory for full design artifacts:
- `prd.md` — Product Requirements Document
- `spec.md` — Technical Specification
- `task.md` — Epic/Task Breakdown

---
Built with [AI Factory](https://github.com/alswp006/ai-factory) · Last synced: 2026-09-20

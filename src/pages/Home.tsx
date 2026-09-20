import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, ListRow, Button, Badge, Toast, TextButton, Asset } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SummaryHero } from '../components/SummaryHero';
import { Card } from '../components/Card';
import { Amount } from '../components/Amount';
import { Sparkline } from '../components/Sparkline';
import { MiniBar } from '../components/MiniBar';
import { EmptyState, LoadingState } from '../components/StateView';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { AdSlot } from '../components/AdSlot';
import { logClick, logImpression } from '../lib/analytics';
import { summarize } from '../lib/summary';
import { currentMonthKST, isFutureMonth, shiftMonth } from '../lib/date';
import { formatKRW, formatMonthLabel, formatDayLabel, formatPercent } from '../lib/format';
import { safeGet, listOrders } from '../lib/storage/core';
import { getSettings } from '../lib/storage/settings';
import { PLATFORM_LABEL, STORAGE_KEYS } from '../lib/types';
import type { DeliveryOrder } from '../lib/types';

const AD_GROUP_ID: string = import.meta.env.VITE_TOSS_AD_GROUP_ID ?? '';

// 하단 탭 4개 — 모든 탭-루트 화면(/, /orders, /report, /settings/goal)이 같은 배열을 쓴다.
const TABS = [
  { label: '홈', path: '/' },
  { label: '기록', path: '/orders' },
  { label: '리포트', path: '/report' },
  { label: '설정', path: '/settings/goal' },
];

function tick(type: 'tickWeak' | 'success') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

export default function Home() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonthKST);
  const [orders, setOrders] = useState<DeliveryOrder[] | null>(null);
  const [goal, setGoal] = useState(0);
  const [toastOpen, setToastOpen] = useState(false);
  const adLogged = useRef(false);

  useEffect(() => {
    let broken = false;
    let list: DeliveryOrder[] = [];
    try {
      broken = !safeGet(STORAGE_KEYS.ORDERS).ok;
      list = broken ? [] : listOrders();
      setGoal(getSettings().monthlyTipGoal);
    } catch {
      broken = true;
    }
    setOrders(list);
    if (broken) setToastOpen(true);
  }, []);

  useEffect(() => {
    if (AD_GROUP_ID && !adLogged.current) {
      adLogged.current = true;
      logImpression('home_banner');
    }
  }, []);

  const summary = useMemo(() => (orders ? summarize(orders, month) : null), [orders, month]);
  const recent = useMemo(
    () =>
      (orders ?? [])
        .filter((o) => o.date.slice(0, 7) === month)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt))
        .slice(0, 3),
    [orders, month],
  );

  const loading = summary === null;
  const empty = !loading && summary.orderCount === 0;
  const isCurrent = isFutureMonth(shiftMonth(month, 1));
  const goalRatio = goal > 0 && summary ? summary.totalTip / goal : 0;

  const moveMonth = (delta: number) => {
    if (delta > 0 && !isCurrent) return;
    tick('tickWeak');
    setMonth((m) => shiftMonth(m, delta));
  };

  const caption = summary
    ? `주문 ${summary.orderCount}회 · 평균 ${formatKRW(summary.avgTip)} · 최소주문 추가 ${formatKRW(summary.totalPadding)}`
    : undefined;

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>이번 달 배달팁</Top.TitleParagraph>} />}
      /* 탭-루트라 하단 고정 CTA(SubmitFooter) 금지 — 1차 액션은 히어로 카드 안에 둔다(탭바와 자리 충돌) */
      bottom={<FloatingTabBar items={TABS} />}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <Button variant="weak" size="small" onClick={() => moveMonth(-1)}>
          이전 달
        </Button>
        <Paragraph.Text typography="st11">{formatMonthLabel(month)}</Paragraph.Text>
        <Button variant="weak" size="small" disabled={isCurrent} onClick={() => moveMonth(1)}>
          다음 달
        </Button>
      </div>
      <Spacing size={16} />

      {loading ? (
        <LoadingState rows={3} testId="home-loading" />
      ) : (
        <>
          <SummaryHero
            testId="tip-summary-hero"
            label={isCurrent ? '이번 달 배달팁' : `${formatMonthLabel(month)} 배달팁`}
            value={<Amount value={summary.totalTip} unit="원" typography="t1" />}
            caption={caption}
            action={
              <Button
                variant="fill"
                size="large"
                display="block"
                onClick={() => {
                  tick('success');
                  logClick('home_add_order');
                  navigate('/orders/new');
                }}
              >
                배달 기록하기
              </Button>
            }
          />
          <Spacing size={16} />

          <Card testId="goal-progress-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Paragraph.Text typography="st11">
                {`${formatKRW(summary.totalTip)} / ${formatKRW(goal)} · ${formatPercent(goalRatio)}`}
              </Paragraph.Text>
              {goalRatio >= 1 ? (
                <Badge size="small" variant="fill" color="green">목표 달성</Badge>
              ) : goalRatio >= 0.8 ? (
                <Badge size="small" variant="fill" color="yellow">목표 임박</Badge>
              ) : null}
            </div>
            <Spacing size={8} />
            <MiniBar ratio={goalRatio} />
            <Spacing size={8} />
            <Button
              variant="weak"
              size="small"
              onClick={() => {
                logClick('edit_goal');
                navigate('/settings/goal', { state: { currentGoal: goal } });
              }}
            >
              목표 수정
            </Button>
          </Card>
          <Spacing size={24} />

          {empty ? (
            <EmptyState
              testId="home-empty"
              icon={<Asset.ContentIcon name="icon-document-lines" alt="" style={{ width: 48, height: 48 }} />}
              title="이번 달 배달 기록이 아직 없어요"
              description="주문을 기록하면 배달팁 합계가 여기에 쌓여요"
            />
          ) : (
            <>
              <Paragraph.Text typography="t4">배달팁 추이</Paragraph.Text>
              <Spacing size={12} />
              <Sparkline testId="tip-trend-sparkline" data={summary.dailyTips} />
              <Spacing size={24} />

              <Card testId="platform-minibar">
                {summary.byPlatform.map((p) => (
                  <div key={p.platform} style={{ paddingBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Paragraph.Text typography="st11">{PLATFORM_LABEL[p.platform]}</Paragraph.Text>
                      <Paragraph.Text typography="st11">{`${formatKRW(p.tip)} · ${formatPercent(p.ratio)}`}</Paragraph.Text>
                    </div>
                    <Spacing size={4} />
                    <MiniBar ratio={p.ratio} />
                  </div>
                ))}
              </Card>
              <Spacing size={24} />

              {summary.pickupSavable > 0 ? (
                <>
                  <Card>
                    <ListRow
                      onClick={() => {
                        tick('tickWeak');
                        logClick('open_pickup_savings');
                        navigate('/savings', { state: { month } });
                      }}
                      contents={
                        <ListRow.Texts
                          type="2RowTypeA"
                          top="픽업했다면?"
                          bottom={`최대 ${formatKRW(summary.pickupSavable)} 아낄 수 있었어요`}
                        />
                      }
                    />
                  </Card>
                  <Spacing size={24} />
                </>
              ) : null}

              <div data-testid="recent-orders-card">
                <Paragraph.Text typography="t4">최근 주문</Paragraph.Text>
                {recent.map((o) => (
                  <ListRow
                    key={o.id}
                    onClick={() => navigate('/orders/' + o.id + '/edit', { state: { order: o } })}
                    contents={
                      <ListRow.Texts
                        type="2RowTypeA"
                        top={`${PLATFORM_LABEL[o.platform]} · ${formatDayLabel(o.date)}`}
                        bottom={`주문 ${formatKRW(o.foodAmount)} · 추가 ${formatKRW(o.minOrderPadding)}`}
                      />
                    }
                    right={<Paragraph.Text typography="st11">{`팁 ${formatKRW(o.deliveryTip)}`}</Paragraph.Text>}
                  />
                ))}
              </div>
            </>
          )}
          <Spacing size={16} />

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <TextButton size="small" onClick={() => navigate('/orders')}>전체 기록</TextButton>
            <TextButton
              size="small"
              onClick={() => {
                logClick('open_monthly_report');
                navigate('/report', { state: { month } });
              }}
            >
              월간 리포트 보기
            </TextButton>
          </div>
          <Spacing size={16} />
        </>
      )}

      {AD_GROUP_ID ? <AdSlot adGroupId={AD_GROUP_ID} /> : null}
      <Spacing size={96} />

      <Toast
        open={toastOpen}
        position="bottom"
        text="저장된 기록을 불러오지 못했어요"
        onClose={() => setToastOpen(false)}
      />
    </ScreenScaffold>
  );
}

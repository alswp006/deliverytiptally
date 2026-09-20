import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Asset, Button, ListRow, Paragraph, Spacing, Top } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { FloatingTabBar } from "@/components/FloatingTabBar";
import { SummaryHero } from "@/components/SummaryHero";
import { Amount } from "@/components/Amount";
import { Card } from "@/components/Card";
import { Sparkline } from "@/components/Sparkline";
import { MiniBar } from "@/components/MiniBar";
import { EmptyState } from "@/components/StateView";
import { TossRewardAd } from "@/components/TossRewardAd";
import { logClick, logImpression } from "@/lib/analytics";
import { currentMonthKST, normalizeMonthParam } from "@/lib/date";
import { formatKRW, formatMonthLabel, formatPercent } from "@/lib/format";
import { shareApp } from "@/lib/share";
import { summarize } from "@/lib/summary";
import { listOrders } from "@/lib/storage/core";
import { isReportUnlocked, markReportUnlocked } from "@/lib/storage/settings";
import { PLATFORM_LABEL } from "@/lib/types";
import type { DeliveryOrder } from "@/lib/types";

const AD_SLOT_ID: string = (import.meta.env.VITE_TOSS_AD_SLOT_ID as string | undefined) ?? "";

const TABS = [
  { label: "홈", path: "/" },
  { label: "기록", path: "/orders" },
  { label: "리포트", path: "/report" },
  { label: "설정", path: "/settings/goal" },
];

function haptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "success" })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

function readOrders(): DeliveryOrder[] {
  try {
    return listOrders();
  } catch {
    return [];
  }
}

function readUnlocked(month: string): boolean {
  try {
    return isReportUnlocked(month);
  } catch {
    return false;
  }
}

export default function Report() {
  const navigate = useNavigate();
  const location = useLocation();
  const stateMonth = (location.state as { month?: unknown } | null)?.month;
  const month = useMemo(
    () => (typeof stateMonth === "string" ? normalizeMonthParam(stateMonth) : currentMonthKST()),
    [stateMonth],
  );

  const summary = useMemo(() => summarize(readOrders(), month), [month]);
  const [unlocked, setUnlocked] = useState(() => readUnlocked(month));
  const cardRef = useRef<HTMLDivElement>(null);
  const impressionLogged = useRef(false);

  const empty = summary.orderCount === 0;
  const showBody = !empty && unlocked;

  useEffect(() => {
    if (!showBody || impressionLogged.current) return;
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting && !impressionLogged.current) {
          impressionLogged.current = true;
          logImpression("report_card");
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [showBody]);

  const handleRewarded = () => {
    try {
      markReportUnlocked(month);
    } catch {
      /* 저장 실패해도 이번 세션에서는 공개 */
    }
    logClick("unlock_report");
    setUnlocked(true);
  };

  const handleShare = () => {
    haptic();
    logClick("share_report");
    void shareApp({
      message: `${formatMonthLabel(month)} 배달팁 ${formatKRW(summary.totalTip)}, 주문 ${summary.orderCount}건이에요`,
      path: "/report",
    });
  };

  const top = summary.byPlatform[0];

  const body = (
    <div ref={cardRef} data-testid="report-card">
      <SummaryHero
        label={`${formatMonthLabel(month)} 배달팁`}
        value={<Amount value={summary.totalTip} unit="원" typography="t1" />}
        caption={`주문 ${summary.orderCount}건 · 평균 ${formatKRW(summary.avgTip)}`}
      />
      <Spacing size={16} />
      <Card>
        <ListRow
          contents={<ListRow.Texts type="2RowTypeA" top="총 배달팁" bottom={`주문 ${summary.orderCount}건`} />}
          right={<Paragraph.Text typography="st11">{formatKRW(summary.totalTip)}</Paragraph.Text>}
        />
        <ListRow
          contents={<ListRow.Texts type="2RowTypeA" top="한 번 주문할 때 평균" bottom="배달팁 기준" />}
          right={<Paragraph.Text typography="st11">{formatKRW(summary.avgTip)}</Paragraph.Text>}
        />
        {top ? (
          <ListRow
            contents={
              <ListRow.Texts type="2RowTypeA" top="가장 많이 쓴 곳" bottom={PLATFORM_LABEL[top.platform]} />
            }
            right={<Paragraph.Text typography="st11">{formatKRW(top.tip)}</Paragraph.Text>}
          />
        ) : null}
        <ListRow
          contents={<ListRow.Texts type="2RowTypeA" top="픽업했다면 아낄 돈" bottom="포장 가능 주문 기준" />}
          right={<Paragraph.Text typography="st11">{formatKRW(summary.pickupSavable)}</Paragraph.Text>}
        />
      </Card>
      <Spacing size={24} />
      <Paragraph.Text typography="t4">일별 배달팁</Paragraph.Text>
      <Spacing size={12} />
      <Sparkline data={summary.dailyTips} />
      {top ? (
        <>
          <Spacing size={24} />
          <Paragraph.Text typography="st11">{`${PLATFORM_LABEL[top.platform]} 비중 ${formatPercent(top.ratio)}`}</Paragraph.Text>
          <Spacing size={8} />
          <MiniBar ratio={top.ratio} />
        </>
      ) : null}
      <Spacing size={24} />
      <Button data-testid="share-button" variant="fill" size="large" display="block" onClick={handleShare}>
        리포트 공유하기
      </Button>
    </div>
  );

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>{`${formatMonthLabel(month)} 리포트`}</Top.TitleParagraph>} />}
      bottom={<FloatingTabBar items={TABS} />}
    >
      <Spacing size={8} />
      {empty ? (
        <EmptyState
          testId="report-empty"
          icon={<Asset.ContentIcon name="icon-document-lines" alt="" style={{ width: 48, height: 48 }} />}
          title="이 달에는 기록이 없어요"
          description="배달을 기록하면 월간 리포트가 만들어져요"
          action={
            <Button
              variant="weak"
              size="medium"
              onClick={() => {
                logClick("report_add_order");
                navigate("/orders/new");
              }}
            >
              배달 기록하기
            </Button>
          }
        />
      ) : unlocked ? (
        body
      ) : (
        <TossRewardAd
          slotId={AD_SLOT_ID}
          description="광고를 보면 이번 달 리포트를 볼 수 있어요"
          buttonText="광고 보고 리포트 확인하기"
          onRewarded={handleRewarded}
        >
          {body}
        </TossRewardAd>
      )}
      <Spacing size={96} />
    </ScreenScaffold>
  );
}

import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Asset, Button, ListRow, Paragraph, Spacing, Top } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { FloatingTabBar } from "@/components/FloatingTabBar";
import { SummaryHero } from "@/components/SummaryHero";
import { Amount } from "@/components/Amount";
import { MiniBar } from "@/components/MiniBar";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/StateView";
import { AdSlot } from "@/components/AdSlot";
import { logClick, logImpression } from "@/lib/analytics";
import { monthOf, normalizeMonthParam } from "@/lib/date";
import { formatKRW, formatMonthLabel, formatPercent } from "@/lib/format";
import { calcSavings } from "@/lib/savings";
import { getOrders } from "@/lib/storage/orders";
import { PLATFORM_LABEL, PLATFORM_ORDER } from "@/lib/types";
import type { DeliveryOrder } from "@/lib/types";

const AD_GROUP_ID = import.meta.env.VITE_TOSS_AD_GROUP_ID as string | undefined;

const TABS = [
  { label: "홈", path: "/" },
  { label: "기록", path: "/orders" },
  { label: "리포트", path: "/report" },
  { label: "설정", path: "/settings/goal" },
];

function loadOrders(): DeliveryOrder[] {
  try {
    const list = getOrders();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function useImpressionOnce(name: string, active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!active || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          logImpression(name);
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [name, active]);
  return ref;
}

export default function Savings() {
  const location = useLocation();
  const rawMonth = (location.state as { month?: string | null } | null)?.month;
  const month = normalizeMonthParam(typeof rawMonth === "string" ? rawMonth : null);

  const orders = useMemo(loadOrders, []);
  const monthOrders = useMemo(() => orders.filter((o) => o && monthOf(o.date) === month), [orders, month]);

  const { savable, ratio, yearly } = useMemo(() => calcSavings(orders, month), [orders, month]);
  const pickupOrders = monthOrders.filter((o) => o.pickupAvailable === true);

  const padding = useMemo(() => {
    let total = 0;
    let count = 0;
    const by = new Map<string, number>();
    for (const o of monthOrders) {
      const pad = Number.isFinite(o.minOrderPadding) ? o.minOrderPadding : 0;
      if (pad <= 0) continue;
      total += pad;
      count += 1;
      by.set(o.platform, (by.get(o.platform) ?? 0) + pad);
    }
    const rows = PLATFORM_ORDER.filter((p) => by.has(p)).map((p) => ({
      platform: p,
      amount: by.get(p) ?? 0,
    }));
    return { total, count, rows };
  }, [monthOrders]);

  const navigate = useNavigate();
  const heroRef = useImpressionOnce("savings_hero", true);
  const adRef = useImpressionOnce("savings_banner", !!AD_GROUP_ID);

  const empty = pickupOrders.length === 0;

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>픽업했다면?</Top.TitleParagraph>} />}
      bottom={<FloatingTabBar items={TABS} />}
    >
      <Spacing size={16} />
      <div ref={heroRef}>
        <SummaryHero
          testId="savings-hero"
          label={`${formatMonthLabel(month)} 아낄 수 있었어요`}
          value={<Amount value={savable} unit="원" typography="t1" />}
          caption={`총 지출의 ${formatPercent(ratio, 1)} · 연 ${formatKRW(yearly)}`}
        />
      </div>
      <Spacing size={24} />

      {empty ? (
        <EmptyState
          testId="savings-empty"
          icon={<Asset.ContentIcon name="icon-document-lines" alt="" style={{ width: 48, height: 48 }} />}
          title="픽업 가능했던 주문이 아직 없어요"
          description="주문을 기록할 때 픽업 가능 여부를 체크해 두면 여기서 계산해요"
        />
      ) : (
        <ListRow
          contents={
            <ListRow.Texts type="2RowTypeA" top="픽업 가능했던 주문" bottom={`${pickupOrders.length}건`} />
          }
          right={<Paragraph.Text typography="st11">{formatKRW(savable)}</Paragraph.Text>}
        />
      )}
      <Spacing size={24} />

      <div data-testid="padding-section">
        <Card>
          <Paragraph.Text typography="t4">최소주문 맞추려 더 쓴 돈</Paragraph.Text>
          <Spacing size={12} />
          {padding.count === 0 ? (
            <Paragraph.Text typography="t6">추가 지출이 없었어요</Paragraph.Text>
          ) : (
            <>
              <Amount value={padding.total} unit="원" typography="t1" />
              <Spacing size={8} />
              <Paragraph.Text typography="st11">{`${padding.count}건에서 발생했어요`}</Paragraph.Text>
              <Spacing size={12} />
              {padding.rows.map((r) => (
                <div key={r.platform}>
                  <ListRow
                    contents={<ListRow.Texts type="1RowTypeA" top={PLATFORM_LABEL[r.platform]} />}
                    right={<Paragraph.Text typography="st11">{formatKRW(r.amount)}</Paragraph.Text>}
                  />
                  <MiniBar ratio={padding.total > 0 ? r.amount / padding.total : 0} />
                  <Spacing size={8} />
                </div>
              ))}
            </>
          )}
        </Card>
      </div>

      <Spacing size={24} />
      <Button
        variant="fill"
        size="large"
        display="block"
        onClick={() => {
          logClick("savings_to_report");
          navigate("/report", { state: { month } });
        }}
      >
        {`${formatMonthLabel(month)} 리포트 보기`}
      </Button>

      {AD_GROUP_ID ? (
        <>
          <Spacing size={16} />
          <div ref={adRef}>
            <AdSlot adGroupId={AD_GROUP_ID} />
          </div>
        </>
      ) : null}
      <Spacing size={88} />
    </ScreenScaffold>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Asset, Button, ListRow, Paragraph, Spacing, Top } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { FloatingTabBar } from "@/components/FloatingTabBar";
import { EmptyState } from "@/components/StateView";
import { AdSlot } from "@/components/AdSlot";
import { logClick, logImpression } from "@/lib/analytics";
import { currentMonthKST, isFutureMonth, monthOf, shiftMonth } from "@/lib/date";
import { formatDayLabel, formatKRW, formatMonthLabel } from "@/lib/format";
import { getOrders } from "@/lib/storage/orders";
import { PLATFORM_LABEL } from "@/lib/types";
import type { DeliveryOrder, Platform } from "@/lib/types";

const SCROLL_KEY = "dtt:scroll:/orders";
const PAGE_SIZE = 20;
const AD_GROUP_ID = import.meta.env.VITE_TOSS_AD_GROUP_ID as string | undefined;

const TABS = [
  { label: "홈", path: "/" },
  { label: "기록", path: "/orders" },
  { label: "리포트", path: "/report" },
  { label: "설정", path: "/settings/goal" },
];

const FILTERS: Platform[] = ["BAEMIN", "COUPANG_EATS", "YOGIYO", "ETC"];

function tick() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {});
  } catch {
    /* WebView 밖 */
  }
}

function readScroll(): number {
  try {
    const n = Number(sessionStorage.getItem(SCROLL_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeScroll(y: number) {
  try {
    sessionStorage.setItem(SCROLL_KEY, String(Math.round(y)));
  } catch {
    /* 저장 실패는 무시 */
  }
}

export default function OrderList() {
  const navigate = useNavigate();
  const location = useLocation();
  const deletedId = (location.state as { deletedId?: string } | null)?.deletedId ?? null;

  const [month, setMonth] = useState(currentMonthKST());
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [orders] = useState<DeliveryOrder[]>(() => {
    try {
      return getOrders();
    } catch {
      return [];
    }
  });
  const [notice, setNotice] = useState<string | null>(deletedId ? "기록을 삭제했어요" : null);

  const adRef = useRef<HTMLDivElement>(null);

  // 스크롤 위치 복원/저장
  useEffect(() => {
    const y = readScroll();
    if (y > 0) {
      try {
        window.scrollTo(0, y);
      } catch {
        /* jsdom */
      }
    }
    const onScroll = () => writeScroll(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  // 배너 노출 로그 — 뷰포트 진입 시 1회
  useEffect(() => {
    const el = adRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          logImpression("orders_banner");
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const monthOrders = useMemo(
    () =>
      orders
        .filter((o) => monthOf(o.date) === month && (platform === null || o.platform === platform))
        .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)),
    [orders, month, platform],
  );
  const monthHasOrders = useMemo(() => orders.some((o) => monthOf(o.date) === month), [orders, month]);

  const shown = monthOrders.slice(0, visible);
  const nextDisabled = isFutureMonth(shiftMonth(month, 1));

  const changeMonth = (delta: number) => {
    tick();
    setMonth((m) => shiftMonth(m, delta));
    setVisible(PAGE_SIZE);
  };

  const toggleFilter = (p: Platform) => {
    tick();
    logClick("filter_platform");
    setPlatform((cur) => (cur === p ? null : p));
    setVisible(PAGE_SIZE);
  };

  const goNew = () => {
    logClick("orders_add_order");
    navigate("/orders/new");
  };

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>주문 내역</Top.TitleParagraph>} />}
      bottom={<FloatingTabBar items={TABS} />}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <Button size="small" variant="weak" onClick={() => changeMonth(-1)}>
          이전 달
        </Button>
        <Paragraph.Text typography="st11">{formatMonthLabel(month)}</Paragraph.Text>
        <Button size="small" variant="weak" disabled={nextDisabled} onClick={() => changeMonth(1)}>
          다음 달
        </Button>
      </div>
      <Spacing size={12} />
      <div data-testid="platform-filter" style={{ display: "flex", gap: 8, overflowX: "auto" }}>
        {FILTERS.map((p) => (
          <Button
            key={p}
            size="small"
            variant={platform === p ? "fill" : "weak"}
            aria-pressed={platform === p}
            onClick={() => toggleFilter(p)}
          >
            {PLATFORM_LABEL[p]}
          </Button>
        ))}
      </div>
      <Spacing size={16} />

      {notice ? (
        <div role="status">
          <Paragraph.Text typography="st11">{notice}</Paragraph.Text>
          <Spacing size={12} />
        </div>
      ) : null}

      {monthOrders.length === 0 ? (
        <EmptyState
          testId="order-empty"
          icon={<Asset.ContentIcon name="icon-document-lines" alt="" />}
          title={monthHasOrders ? "이 플랫폼 기록이 없어요" : "이 달에는 기록이 없어요"}
          action={
            <Button variant="weak" onClick={goNew}>
              배달 기록하기
            </Button>
          }
        />
      ) : (
        <div data-testid="order-list">
          {shown.map((o) => (
            <ListRow
              key={o.id}
              data-testid="order-row"
              contents={
                <ListRow.Texts
                  type="2RowTypeA"
                  top={`${PLATFORM_LABEL[o.platform] ?? "기타"} · ${formatDayLabel(o.date)}`}
                  bottom={`주문 ${formatKRW(o.foodAmount)} · 추가 ${formatKRW(o.minOrderPadding)}`}
                />
              }
              right={<Paragraph.Text typography="st11">{`팁 ${formatKRW(o.deliveryTip)}`}</Paragraph.Text>}
              onClick={() => navigate("/orders/" + o.id + "/edit", { state: { order: o } })}
            />
          ))}
          {monthOrders.length > shown.length ? (
            <>
              <Spacing size={12} />
              <Button display="block" variant="weak" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                더보기
              </Button>
            </>
          ) : null}
        </div>
      )}

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

import { useRef, useState } from "react";
import type { ChangeEvent, ComponentType, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Top,
  ListRow,
  Chip,
  Switch,
  TextField,
  Spacing,
  Paragraph,
  BottomSheet,
  Toast,
  FixedBottomCTA,
} from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { logClick } from "@/lib/analytics";
import { todayKST } from "@/lib/date";
import { getSettings } from "@/lib/storage/settings";
import { addOrder, validateOrderInput } from "@/lib/storage/orders";
import { PLATFORM_LABEL, PLATFORM_ORDER } from "@/lib/types";
import type { OrderInput, Platform } from "@/lib/types";

type FieldKey = "foodAmount" | "deliveryTip" | "minOrderPadding" | "memo" | "date";

const DATE_OPTION_DAYS = 31;

function haptic(type: "success" | "tickWeak") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

/** 숫자만 남기고 천단위 콤마를 붙인다. 빈 값은 빈 문자열. */
function formatDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9).replace(/^0+(?=\d)/, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function toInt(display: string): number {
  const n = parseInt(display.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function dateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

/** YYYY-MM-DD 에서 days 일 전 (UTC 산술 — 시간대 영향 없음) */
function daysBefore(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - days));
  return t.toISOString().slice(0, 10);
}

// Chip은 그룹(Chip)+아이템(Chip.Item) 구조다. 아이템 컴포넌트가 없으면 Chip 자체를 쓴다.
type ChipItemLike = ComponentType<{
  selected?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}>;
const chipAny = Chip as unknown as { Item?: ChipItemLike };
const ChipItem: ChipItemLike = chipAny.Item ?? (Chip as unknown as ChipItemLike);
const ChipGroup: ComponentType<{ children: ReactNode }> = chipAny.Item
  ? (Chip as unknown as ComponentType<{ children: ReactNode }>)
  : ({ children }) => <>{children}</>;

export default function OrderNew() {
  const navigate = useNavigate();
  const today = todayKST();

  const [date, setDate] = useState(today);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>(() => getSettings().defaultPlatform);
  const [food, setFood] = useState("");
  const [tip, setTip] = useState("");
  const [padding, setPadding] = useState("");
  const [memo, setMemo] = useState("");
  const [pickup, setPickup] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const submitting = useRef(false);
  const formRef = useRef<HTMLDivElement>(null);

  const numberField =
    (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) =>
      setter(formatDigits(e.target.value));

  function focusFirstError(errs: Partial<Record<FieldKey, string>>) {
    const order: FieldKey[] = ["date", "foodAmount", "deliveryTip", "minOrderPadding", "memo"];
    const first = order.find((k) => errs[k]);
    if (!first) return;
    const input = formRef.current?.querySelector<HTMLInputElement>(`[data-field="${first}"] input`);
    if (input) {
      input.focus?.();
      input.scrollIntoView?.({ block: "center" });
    }
  }

  function handleSave() {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);

    const input: OrderInput = {
      date,
      platform,
      foodAmount: toInt(food),
      deliveryTip: toInt(tip),
      minOrderPadding: toInt(padding),
      pickupAvailable: pickup,
      memo: memo.trim(),
    };

    const valid = validateOrderInput(input);
    if (!valid.ok) {
      const errs = (valid.errors ?? {}) as Partial<Record<FieldKey, string>>;
      setErrors(errs);
      focusFirstError(errs);
      submitting.current = false;
      setSaving(false);
      return;
    }
    setErrors({});

    const result = addOrder(input);
    if (!result.ok) {
      if (result.reason === "LIMIT") setToast("기록은 2,000건까지 저장할 수 있어요");
      else if (result.reason === "QUOTA") setToast("저장 공간이 부족해요");
      else if (result.reason === "INVALID" && result.errors) {
        setErrors(result.errors as Partial<Record<FieldKey, string>>);
      } else setToast("저장하지 못했어요. 잠시 후 다시 시도해 주세요");
      submitting.current = false;
      setSaving(false);
      return;
    }

    haptic("success");
    logClick("save_order");
    navigate("/", { state: { savedOrderId: result.data.id } });
  }

  const dateOptions = Array.from({ length: DATE_OPTION_DAYS }, (_, i) => daysBefore(today, i));

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>배달 기록</Top.TitleParagraph>} />}
      bottom={
        <FixedBottomCTA loading={saving} disabled={saving} onClick={handleSave}>
          저장하기
        </FixedBottomCTA>
      }
    >
      <div ref={formRef}>
        <ListRow
          contents={<ListRow.Texts type="2RowTypeA" top="날짜" bottom={dateLabel(date)} />}
          onClick={() => setSheetOpen(true)}
        />
        {errors.date && (
          <Paragraph.Text typography="t7">{errors.date}</Paragraph.Text>
        )}
        <Spacing size={16} />
        <Paragraph.Text typography="t5">배달 플랫폼</Paragraph.Text>
        <Spacing size={8} />
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          <ChipGroup>
            {PLATFORM_ORDER.map((p) => (
              <ChipItem
                key={p}
                selected={platform === p}
                onClick={() => {
                  haptic("tickWeak");
                  setPlatform(p);
                }}
              >
                {PLATFORM_LABEL[p]}
              </ChipItem>
            ))}
          </ChipGroup>
        </div>
        <Spacing size={24} />
        <div data-field="foodAmount">
          <TextField
            variant="box"
            label="주문 금액"
            placeholder="예: 18,000"
            value={food}
            onChange={numberField(setFood)}
            inputMode="numeric"
            enterKeyHint="next"
            suffix="원"
            help={errors.foodAmount}
            hasError={!!errors.foodAmount}
          />
        </div>
        <Spacing size={12} />
        <div data-field="deliveryTip">
          <TextField
            variant="box"
            label="배달팁"
            placeholder="예: 3,000"
            value={tip}
            onChange={numberField(setTip)}
            inputMode="numeric"
            enterKeyHint="next"
            suffix="원"
            help={errors.deliveryTip}
            hasError={!!errors.deliveryTip}
          />
        </div>
        <Spacing size={12} />
        <div data-field="minOrderPadding">
          <TextField
            variant="box"
            label="최소주문 추가금액"
            placeholder="예: 2,000"
            value={padding}
            onChange={numberField(setPadding)}
            inputMode="numeric"
            enterKeyHint="next"
            suffix="원"
            help={errors.minOrderPadding}
            hasError={!!errors.minOrderPadding}
          />
        </div>
        <Spacing size={12} />
        <div data-field="memo">
          <TextField
            variant="box"
            label="메모"
            placeholder="예: 야식, 회식"
            value={memo}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setMemo(e.target.value)}
            maxLength={30}
            enterKeyHint="done"
            help={errors.memo}
            hasError={!!errors.memo}
          />
        </div>
        <Spacing size={16} />
        <ListRow
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top="픽업 가능했어요"
              bottom="켜두면 절약액을 계산해드려요"
            />
          }
          right={
            <Switch
              checked={pickup}
              onChange={() => {
                haptic("tickWeak");
                setPickup((v) => !v);
              }}
            />
          }
        />
        <Spacing size={100} />
      </div>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}
        header={<BottomSheet.Header>날짜 선택</BottomSheet.Header>}
      >
        <div style={{ maxHeight: "50dvh", overflowY: "auto" }}>
          {dateOptions.map((d) => (
            <ListRow
              key={d}
              contents={
                <ListRow.Texts
                  type="1RowTypeA"
                  top={d === today ? `${dateLabel(d)} (오늘)` : dateLabel(d)}
                />
              }
              onClick={() => {
                setDate(d);
                setSheetOpen(false);
              }}
            />
          ))}
        </div>
      </BottomSheet>

      <Toast open={toast !== null} position="bottom" text={toast ?? ""} onClose={() => setToast(null)} />
    </ScreenScaffold>
  );
}

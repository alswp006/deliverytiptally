import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, ComponentType, ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Top,
  ListRow,
  Chip,
  ChipItem,
  Switch,
  TextField,
  Spacing,
  Paragraph,
  BottomSheet,
  ConfirmDialog,
  Toast,
  Button,
  FixedBottomCTA,
} from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { EmptyState } from "@/components/StateView";
import { logClick } from "@/lib/analytics";
import { todayKST } from "@/lib/date";
import { deleteOrder, getOrders, updateOrder, validateOrderInput } from "@/lib/storage/orders";
import { PLATFORM_LABEL, PLATFORM_ORDER } from "@/lib/types";
import type { DeliveryOrder, OrderInput, Platform, RouteState } from "@/lib/types";

type FieldKey = "foodAmount" | "deliveryTip" | "minOrderPadding" | "memo" | "date";

const DATE_OPTION_DAYS = 31;

function haptic(type: "success" | "tickWeak") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

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

function daysBefore(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
}

// TDS Chip은 그룹 컨테이너(div), ChipItem이 개별 칩(button) — 둘 다 최상위 export(`Chip.Item` 없음).
const ChipGroup = Chip as unknown as ComponentType<{ children: ReactNode }>;

function withCommas(n: number): string {
  return formatDigits(String(Math.max(0, Math.floor(n || 0))));
}

export default function OrderEdit() {
  const { id = "" } = useParams();
  const location = useLocation();
  const state = (location.state as RouteState["/orders/:id/edit"]) ?? null;

  const order = useMemo<DeliveryOrder | null>(() => {
    const fromState = state?.order;
    if (fromState && fromState.id === id) return fromState;
    return getOrders().find((o) => o.id === id) ?? null;
  }, [id, state]);

  if (!order) return <NotFound />;
  return <EditForm key={order.id} order={order} />;
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>기록 수정</Top.TitleParagraph>} />}>
      <EmptyState
        testId="order-edit-not-found"
        title="기록을 찾을 수 없어요"
        description="이미 삭제됐거나 없는 기록이에요"
        action={
          <Button variant="weak" size="large" display="block" onClick={() => navigate("/orders")}>
            목록으로
          </Button>
        }
      />
    </ScreenScaffold>
  );
}

function EditForm({ order }: { order: DeliveryOrder }) {
  const navigate = useNavigate();
  const today = todayKST();

  const [date, setDate] = useState(order.date);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>(order.platform);
  const [food, setFood] = useState(withCommas(order.foodAmount));
  const [tip, setTip] = useState(withCommas(order.deliveryTip));
  const [padding, setPadding] = useState(withCommas(order.minOrderPadding));
  const [memo, setMemo] = useState(order.memo ?? "");
  const [pickup, setPickup] = useState(order.pickupAvailable === true);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const busy = useRef(false);
  const formRef = useRef<HTMLDivElement>(null);

  const numberField =
    (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) =>
      setter(formatDigits(e.target.value));

  function focusFirstError(errs: Partial<Record<FieldKey, string>>) {
    const keys: FieldKey[] = ["date", "foodAmount", "deliveryTip", "minOrderPadding", "memo"];
    const first = keys.find((k) => errs[k]);
    if (!first) return;
    const input = formRef.current?.querySelector<HTMLInputElement>(`[data-field="${first}"] input`);
    input?.focus?.();
    input?.scrollIntoView?.({ block: "center" });
  }

  function release() {
    busy.current = false;
    setSaving(false);
  }

  function handleSave() {
    if (busy.current) return;
    busy.current = true;
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
      release();
      return;
    }
    setErrors({});

    const result = updateOrder(order.id, input);
    if (!result.ok) {
      if (result.reason === "NOT_FOUND") {
        setToast("기록을 찾을 수 없어요");
        navigate("/orders");
        return;
      }
      if (result.reason === "INVALID" && result.errors) {
        setErrors(result.errors as Partial<Record<FieldKey, string>>);
      } else if (result.reason === "QUOTA") {
        setToast("저장 공간이 부족해요");
      } else {
        setToast("저장하지 못했어요. 잠시 후 다시 시도해 주세요");
      }
      release();
      return;
    }

    haptic("success");
    logClick("update_order");
    navigate("/orders", { state: { focusMonth: date.slice(0, 7) } });
  }

  function handleDelete() {
    if (busy.current) return;
    busy.current = true;
    setConfirmOpen(false);
    const result = deleteOrder(order.id);
    if (!result.ok && result.reason !== "NOT_FOUND") {
      setToast("삭제하지 못했어요. 잠시 후 다시 시도해 주세요");
      busy.current = false;
      return;
    }
    logClick("delete_order");
    navigate("/orders", { state: { deletedId: order.id } });
  }

  const dateOptions = useMemo(() => {
    const list = Array.from({ length: DATE_OPTION_DAYS }, (_, i) => daysBefore(today, i));
    return list.includes(order.date) ? list : [order.date, ...list];
  }, [today, order.date]);

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>기록 수정</Top.TitleParagraph>} />}
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
        {errors.date && <Paragraph.Text typography="t7">{errors.date}</Paragraph.Text>}
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
            placeholder="주문 금액 예: 18,000"
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
            placeholder="배달팁 예: 3,000"
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
            placeholder="최소주문 추가금액 예: 2,000"
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
            placeholder="메모 예: 야식, 회식"
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
            <ListRow.Texts type="2RowTypeA" top="픽업 가능했어요" bottom="켜두면 절약액을 계산해드려요" />
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
        <Spacing size={24} />
        <Button variant="weak" size="large" display="block" onClick={() => setConfirmOpen(true)}>
          삭제
        </Button>
        <Spacing size={100} />
      </div>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
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

      <ConfirmDialog
        open={confirmOpen}
        title={<ConfirmDialog.Title>이 기록을 삭제할까요?</ConfirmDialog.Title>}
        description={<ConfirmDialog.Description>삭제하면 되돌릴 수 없어요</ConfirmDialog.Description>}
        cancelButton={
          <ConfirmDialog.CancelButton onClick={() => setConfirmOpen(false)}>닫기</ConfirmDialog.CancelButton>
        }
        confirmButton={<ConfirmDialog.ConfirmButton onClick={handleDelete}>삭제</ConfirmDialog.ConfirmButton>}
        onClose={() => setConfirmOpen(false)}
      />

      <Toast open={toast !== null} position="bottom" text={toast ?? ""} onClose={() => setToast(null)} />
    </ScreenScaffold>
  );
}

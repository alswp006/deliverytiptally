import { useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Top, Chip, ChipItem, TextField, Spacing, Paragraph, Toast, Button } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { FloatingTabBar } from "@/components/FloatingTabBar";
import { logClick } from "@/lib/analytics";
import { getSettings, saveSettings, validateGoal } from "@/lib/storage/settings";
import { PLATFORM_LABEL, PLATFORM_ORDER } from "@/lib/types";
import type { Platform, RouteState } from "@/lib/types";

// 하단 탭 4개 — 탭-루트 화면이 공유하는 배열(홈/기록/리포트와 동일 순서).
const TABS = [
  { label: "홈", path: "/" },
  { label: "기록", path: "/orders" },
  { label: "리포트", path: "/report" },
  { label: "설정", path: "/settings/goal" },
];

const PRESETS = [
  { label: "2만원", value: 20000 },
  { label: "3만원", value: 30000 },
  { label: "5만원", value: 50000 },
];

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
  return Number.isFinite(n) ? n : NaN;
}

// TDS Chip은 그룹 컨테이너(div), ChipItem이 개별 칩(button) — 둘 다 최상위 export(`Chip.Item` 없음).
const ChipGroup = Chip as unknown as ComponentType<{ children: ReactNode }>;

export default function GoalSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as RouteState["/settings/goal"] & { currentGoal?: number }) ?? null;

  const [initial] = useState(() => getSettings());
  const [goal, setGoal] = useState(() => {
    const fromState = state?.currentGoal;
    return formatDigits(
      String(typeof fromState === "number" && fromState > 0 ? fromState : initial.monthlyTipGoal),
    );
  });
  const [platform, setPlatform] = useState<Platform>(initial.defaultPlatform);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const busy = useRef(false);

  function handleSave() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    const release = () => {
      busy.current = false;
      setSaving(false);
    };

    const value = toInt(goal);
    const valid = validateGoal(value);
    if (!valid.ok) {
      setError(valid.errors?.monthlyTipGoal ?? "목표 금액을 확인해 주세요");
      release();
      return;
    }
    setError(null);

    const result = saveSettings({ monthlyTipGoal: value, defaultPlatform: platform });
    if (!result.ok) {
      setToast(
        result.reason === "QUOTA"
          ? "저장 공간이 부족해요"
          : "저장하지 못했어요. 잠시 후 다시 시도해 주세요",
      );
      release();
      return;
    }

    haptic("success");
    logClick("save_goal");
    navigate("/");
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>월 배달비 목표</Top.TitleParagraph>} />}
      /* 탭-루트라 하단 고정 CTA 금지 — 저장 버튼은 본문 최하단 전체폭 Button으로 둔다 */
      bottom={<FloatingTabBar items={TABS} />}
    >
      <Spacing size={16} />
      <TextField
        variant="box"
        label="목표 금액"
        placeholder="예: 30,000"
        value={goal}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          setGoal(formatDigits(e.target.value));
          if (error) setError(null);
        }}
        inputMode="numeric"
        enterKeyHint="done"
        suffix="원"
        help={error ?? undefined}
        hasError={!!error}
      />
      <Spacing size={12} />
      <div style={{ display: "flex", gap: 8 }}>
        <ChipGroup>
          {PRESETS.map((p) => (
            <ChipItem
              key={p.value}
              selected={toInt(goal) === p.value}
              onClick={() => {
                haptic("tickWeak");
                setGoal(formatDigits(String(p.value)));
                setError(null);
              }}
            >
              {p.label}
            </ChipItem>
          ))}
        </ChipGroup>
      </div>
      <Spacing size={24} />
      <Paragraph.Text typography="t5">기본 플랫폼</Paragraph.Text>
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
      <Paragraph.Text typography="st13">기록은 이 기기에만 저장돼요</Paragraph.Text>
      <Spacing size={16} />
      <Button
        variant="fill"
        size="large"
        display="block"
        loading={saving}
        disabled={saving}
        onClick={handleSave}
      >
        저장하기
      </Button>
      <Spacing size={96} />
      {toast !== null && (
        <Toast open position="bottom" text={toast} onClose={() => setToast(null)} />
      )}
    </ScreenScaffold>
  );
}

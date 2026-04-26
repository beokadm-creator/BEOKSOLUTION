import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, onSnapshot, Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Maximize,
  Minimize,
  PlayCircle,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db, functions } from "@/firebase";
import { cn } from "@/lib/utils";
import type { StampTourConfig, StampTourProgress, StampTourReward } from "@/types/schema";
import {
  getSelectableStampTourRewards,
  getStampTourRewardTitle,
  isStampTourRewardDrawCompleted,
  maskStampTourParticipantName
} from "@/utils/stampTour";
import {
  RouletteWheel,
  confettiBurst,
  useDrawSound
} from "@/utils/drawAnimation";

type DrawMode = "PARTIAL" | "DEMO";

type DrawWinner = {
  userId: string;
  userName?: string | null;
  userOrg?: string | null;
  rewardName?: string;
  rewardLabel?: string;
};

type DrawResult = {
  totalEligible: number;
  totalSelected: number;
  totalNotSelected: number;
  drawMode: DrawMode;
  selectedParticipants: DrawWinner[];
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const displayName = (name: string | null | undefined, masked: boolean) => {
  const safe = (name || "").trim();
  if (!safe) return "Name unavailable";
  return masked ? maskStampTourParticipantName(safe) : safe;
};

const formatKst = (ts?: Timestamp) => ts
  ? new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(ts.toDate())
  : "-";

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const demoRows: StampTourProgress[] = [
  { id: "demo-1", userId: "demo-1", conferenceId: "demo", userName: "Demo User 1", userOrg: "Booth A", isCompleted: true, rewardStatus: "NONE" },
  { id: "demo-2", userId: "demo-2", conferenceId: "demo", userName: "Demo User 2", userOrg: "Booth B", isCompleted: true, rewardStatus: "NONE" },
  { id: "demo-3", userId: "demo-3", conferenceId: "demo", userName: "Demo User 3", userOrg: "Booth C", isCompleted: true, rewardStatus: "NONE" },
  { id: "demo-4", userId: "demo-4", conferenceId: "demo", userName: "Demo User 4", userOrg: "Booth D", isCompleted: true, rewardStatus: "NONE" }
];

const dualLabel = (ko: string, en: string) => `${ko} / ${en}`;

/* -------------------------------------------------------------------------- */
/*  RouletteWheelSVG                                                          */
/* -------------------------------------------------------------------------- */

function RouletteWheelSVG({
  participants,
  angle,
  masked,
  winnerIndex
}: {
  participants: Array<{ userName?: string | null; userOrg?: string | null }>;
  angle: number;
  masked: boolean;
  winnerIndex: number | null;
}) {
  const size = 680;
  const radius = 300;
  const center = size / 2;
  const sliceCount = participants.length;
  const sliceAngle = 360 / sliceCount;

  const fills = ["#1e1b4b", "#312e81", "#3730a3"];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
      <defs>
        <radialGradient id="rimGlow">
          <stop offset="92%" stopColor="rgba(79,70,229,0)" />
          <stop offset="96%" stopColor="rgba(129,140,248,0.65)" />
          <stop offset="100%" stopColor="rgba(79,70,229,0)" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="textGlow">
          <feGaussianBlur stdDeviation="0.9" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Rotating wheel group */}
      <g transform={`rotate(${angle} ${center} ${center})`}>
        {participants.map((p, i) => {
          const startAngle = (i * sliceAngle - 90) * Math.PI / 180;
          const endAngle = ((i + 1) * sliceAngle - 90) * Math.PI / 180;
          const x1 = center + radius * Math.cos(startAngle);
          const y1 = center + radius * Math.sin(startAngle);
          const x2 = center + radius * Math.cos(endAngle);
          const y2 = center + radius * Math.sin(endAngle);
          const largeArc = sliceAngle > 180 ? 1 : 0;
          const midAngle = ((i + 0.5) * sliceAngle - 90) * Math.PI / 180;
          const textRadius = radius * 0.65;
          const tx = center + textRadius * Math.cos(midAngle);
          const ty = center + textRadius * Math.sin(midAngle);

          const isWinner = winnerIndex === i;

          return (
            <g key={i}>
              <path
                d={`M${center},${center} L${x1},${y1} A${radius},${radius} 0 ${largeArc},1 ${x2},${y2} Z`}
                fill={fills[i % 3]}
                stroke="rgba(129,140,248,0.3)"
                strokeWidth="1"
              />
              {isWinner && (
                <path
                  d={`M${center},${center} L${x1},${y1} A${radius},${radius} 0 ${largeArc},1 ${x2},${y2} Z`}
                  fill="rgba(251,191,36,0.35)"
                />
              )}
              <text
                x={tx}
                y={ty}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${(i + 0.5) * sliceAngle}, ${tx}, ${ty})`}
                fill="white"
                fontSize={Math.min(14, 280 / sliceCount)}
                fontWeight="bold"
                filter="url(#textGlow)"
              >
                {displayName(p.userName, masked)}
              </text>
            </g>
          );
        })}
      </g>

      {/* Center hub */}
      <circle cx={center} cy={center} r="50" fill="#0f0a2e" stroke="rgba(129,140,248,0.5)" strokeWidth="2" />
      <text x={center} y={center} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="18" fontWeight="900">
        🎯
      </text>

      {/* Rim glow */}
      <circle cx={center} cy={center} r={radius + 15} fill="none" stroke="url(#rimGlow)" strokeWidth="30" />

      {/* Top arrow pointer (FIXED — does not rotate) */}
      <polygon
        points={`${center - 15},${center - radius - 25} ${center + 15},${center - radius - 25} ${center},${center - radius + 5}`}
        fill="#fbbf24"
        filter="url(#glow)"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Spring bounce keyframes (injected once via <style>)                       */
/* -------------------------------------------------------------------------- */

const SPRING_BOUNCE_STYLE: React.CSSProperties = {
  animation: "springBounce 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards"
};

const SPRING_KEYFRAMES = `
@keyframes springBounce {
  0% { opacity: 0; transform: scale(0.6) translateY(16px); }
  60% { transform: scale(1.08) translateY(-4px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  @keyframes springBounce {
    0%, 100% { opacity: 1; transform: none; }
  }
}`;

/* -------------------------------------------------------------------------- */
/*  Main Component                                                            */
/* -------------------------------------------------------------------------- */

export default function StampTourDrawPage() {
  const { cid } = useParams<{ cid: string }>();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const runRef = useRef(0);

  const [config, setConfig] = useState<StampTourConfig | null>(null);
  const [rows, setRows] = useState<StampTourProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [masked, setMasked] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "spinning" | "stopping" | "revealing" | "done">("idle");
  const [wheelAngle, setWheelAngle] = useState(0);
  const [result, setResult] = useState<DrawResult | null>(null);
  const [revealed, setRevealed] = useState<DrawWinner[]>([]);
  const [activeWinnerId, setActiveWinnerId] = useState<string | null>(null);
  const [winnerSliceIndex, setWinnerSliceIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [selectedCounts, setSelectedCounts] = useState<Record<string, number>>({});

  /* -- RouletteWheel + Sound ------------------------------------------------ */

  const wheelRef = useRef<RouletteWheel | null>(null);
  const { playSound, startDrumroll, toggleMute, muted } = useDrawSound();

  useEffect(() => {
    wheelRef.current = new RouletteWheel(setWheelAngle);
    return () => { wheelRef.current?.destroy(); };
  }, []);

  /* -- Firestore listeners --------------------------------------------------- */

  useEffect(() => {
    if (!cid) return;

    const unsubConfig = onSnapshot(doc(db, `conferences/${cid}/settings`, "stamp_tour"), (snap) => {
      setConfig(snap.exists() ? (snap.data() as StampTourConfig) : null);
      setLoading(false);
    });

    const unsubRows = onSnapshot(collection(db, `conferences/${cid}/stamp_tour_progress`), (snap) => {
      setRows(snap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<StampTourProgress, "id">) })));
    });

    return () => {
      unsubConfig();
      unsubRows();
    };
  }, [cid]);

  /* -- Fullscreen + clock --------------------------------------------------- */

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const kickoff = window.setTimeout(() => setNowMs(Date.now()), 0);
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, []);

  /* -- Computed values ------------------------------------------------------- */

  const completed = useMemo(() => rows.filter((row) => row.isCompleted), [rows]);

  const eligible = useMemo(() => {
    if (!config?.lotteryScheduledAt) return [];
    const cutoff = config.lotteryScheduledAt.toMillis();
    return completed.filter((row) => {
      const completedAt = row.completedAt?.toMillis?.();
      return Boolean(
        completedAt
        && completedAt <= cutoff
        && row.rewardStatus !== "REQUESTED"
        && row.rewardStatus !== "REDEEMED"
        && !row.lotteryExecutedAt
      );
    });
  }, [completed, config]);

  const selectableRewards = useMemo(() => {
    const rewards = Array.isArray(config?.rewards) ? config.rewards : [];
    return getSelectableStampTourRewards(rewards, { excludeCompletedDraws: true });
  }, [config]);

  const selectedSlots = useMemo(() => {
    const selectableIds = new Set(selectableRewards.map((reward) => reward.id));
    return Object.entries(selectedCounts).reduce(
      (sum, [rewardId, count]) => sum + (selectableIds.has(rewardId) ? count : 0),
      0
    );
  }, [selectableRewards, selectedCounts]);

  const drawSource = useMemo(() => {
    return eligible.length > 0 ? eligible : completed.length > 0 ? completed : demoRows;
  }, [completed, eligible]);

  const drawOpen = Boolean(
    nowMs !== null
    && config?.lotteryScheduledAt
    && config.lotteryScheduledAt.toMillis() <= nowMs
  );

  /* -- Reward count --------------------------------------------------------- */

  const setRewardCount = (reward: StampTourReward, next: number) => {
    if (isStampTourRewardDrawCompleted(reward)) return;
    setSelectedCounts((prev) => ({
      ...prev,
      [reward.id]: Math.max(0, Math.min(next, reward.remainingQty))
    }));
  };

  /* -- Play result (wheel spin + reveal) ------------------------------------- */

  const playResult = async (next: DrawResult) => {
    const runId = Date.now();
    runRef.current = runId;
    setResult(null);
    setRevealed([]);
    setActiveWinnerId(null);
    setWinnerSliceIndex(null);
    setError(null);

    // Start spinning the wheel
    setPhase("spinning");
    wheelRef.current?.start();
    const stopDrumroll = startDrumroll();

    // Wait for cloud function response to determine winner
    await wait(3600);
    if (runRef.current !== runId) { stopDrumroll(); return; }

    setResult(next);

    // Begin deceleration
    if (next.selectedParticipants.length > 0 && wheelRef.current) {
      const source = drawSource;
      const firstWinner = next.selectedParticipants[0];
      const winnerIdx = source.findIndex((r) => r.userId === firstWinner.userId);
      const resolvedIdx = winnerIdx >= 0 ? winnerIdx : 0;
      wheelRef.current.stopAt(source.length, resolvedIdx);
      setWinnerSliceIndex(resolvedIdx);
      setPhase("stopping");

      // Wait for wheel to settle (easeOutQuart deceleration ~5-6s)
      await wait(6000);
      if (runRef.current !== runId) { stopDrumroll(); return; }
    }

    stopDrumroll();
    playSound("winner");
    confettiBurst(5000);

    // Reveal winners one by one
    setPhase("revealing");
    for (const winner of next.selectedParticipants) {
      if (runRef.current !== runId) return;
      setActiveWinnerId(winner.userId);
      setRevealed((prev) => [...prev, winner]);
      await wait(1200);
    }
    setPhase("done");
  };

  /* -- Run draw ------------------------------------------------------------- */

  const runDraw = async (mode: DrawMode) => {
    if (mode !== "DEMO") {
      if (!cid || !config?.enabled || config.rewardFulfillmentMode !== "LOTTERY") {
        return setError("This page only works for lottery-based rewards.");
      }
      if (!drawOpen) return setError("The draw can only start after the scheduled time.");
      if (mode === "PARTIAL" && selectedSlots <= 0) return setError("Select at least one reward slot first.");
      if (eligible.length === 0) return setError("There are no eligible participants to draw.");
    }

    if (mode === "DEMO") {
      const rewardTitles = selectableRewards.flatMap((reward) => {
        const count = selectedCounts[reward.id] || 0;
        const useCount = selectedSlots > 0 ? count : Math.min(1, reward.remainingQty);
        return Array.from({ length: useCount }, () => getStampTourRewardTitle(reward) || reward.name);
      });
      const winners = shuffle(eligible.length > 0 ? eligible : demoRows)
        .slice(0, Math.max(1, rewardTitles.length))
        .map((row, index) => ({
          userId: row.userId,
          userName: row.userName,
          userOrg: row.userOrg,
          rewardName: rewardTitles[index] || "Prize",
          rewardLabel: rewardTitles[index] || undefined
        }));
      return playResult({
        totalEligible: (eligible.length > 0 ? eligible : demoRows).length,
        totalSelected: winners.length,
        totalNotSelected: Math.max(0, (eligible.length > 0 ? eligible : demoRows).length - winners.length),
        drawMode: "DEMO",
        selectedParticipants: winners
      });
    }

    try {
      const callable = httpsCallable(functions, "runStampRewardLottery");
      const response = await callable({
        confId: cid,
        drawAllRemaining: false,
        drawCountsByRewardId: selectedCounts
      });
      const payload = response.data as Partial<DrawResult>;
      await playResult({
        totalEligible: payload.totalEligible || 0,
        totalSelected: payload.totalSelected || 0,
        totalNotSelected: payload.totalNotSelected || 0,
        drawMode: payload.drawMode === "ALL" ? "PARTIAL" : (payload.drawMode || mode),
        selectedParticipants: Array.isArray(payload.selectedParticipants) ? payload.selectedParticipants : []
      });
      setSelectedCounts({});
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "Draw failed.");
    }
  };

  /* -- Fullscreen ----------------------------------------------------------- */

  const toggleFullscreen = async () => {
    if (!boxRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await boxRef.current.requestFullscreen();
  };

  /* -- Keyboard shortcuts --------------------------------------------------- */

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (phase === "idle") void runDraw("DEMO");
          break;
        case "f":
        case "F":
          void toggleFullscreen();
          break;
        case "m":
        case "M":
          toggleMute();
          break;
        case "d":
        case "D":
          if (phase === "idle") void runDraw("DEMO");
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase, runDraw, toggleFullscreen, toggleMute]);

  /* -- Loading guard -------------------------------------------------------- */

  if (loading) return <div className="p-8 text-sm text-slate-500">{dualLabel("추첨 화면 불러오는 중", "Loading draw screen")}</div>;

  /* -- Phase label ---------------------------------------------------------- */

  const phaseLabel = phase === "idle"
    ? dualLabel("대기", "Idle")
    : phase === "spinning"
      ? dualLabel("회전 중", "Spinning")
      : phase === "stopping"
        ? dualLabel("감속 중", "Slowing")
        : phase === "revealing"
          ? dualLabel("공개 중", "Revealing")
          : dualLabel("완료", "Done");

  /* ----------------------------------------------------------------------- */
  /*  Render                                                                 */
  /* ----------------------------------------------------------------------- */

  return (
    <div
      ref={boxRef}
      className="min-h-full bg-[radial-gradient(circle_at_top,#dbeafe_0%,#eff6ff_40%,#ffffff_100%)] p-6 md:p-8"
    >
      {/* Inject spring keyframes */}
      <style>{SPRING_KEYFRAMES}</style>

      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              to={cid ? `/admin/conf/${cid}/settings#stamp-tour` : "/admin/society"}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" /> {dualLabel("설정으로 돌아가기", "Back to settings")}
            </Link>
            <div className="mt-3 flex items-center gap-3">
              <div className="rounded-2xl bg-slate-900 p-3 text-white">
                <Trophy className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900">{dualLabel("스탬프투어 추첨 관리자", "Stamp Tour Draw Console")}</h1>
                <p className="text-sm text-slate-600">
                  {dualLabel("관리자가 추첨할 상품을 선택하고 바로 추첨을 시작할 수 있습니다.", "Select the reward target and start the draw immediately.")}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setMasked((prev) => !prev)}>
              {masked ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {masked ? dualLabel("이름 마스킹", "Mask names") : dualLabel("이름 표시", "Show names")}
            </Button>
            <Button variant="outline" onClick={toggleMute}>
              {muted ? <VolumeX className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}
              {muted ? dualLabel("소리 끔", "Muted") : dualLabel("소리 켜짐", "Sound on")}
            </Button>
            <Button variant="outline" onClick={() => void toggleFullscreen()}>
              {fullscreen ? <Minimize className="mr-2 h-4 w-4" /> : <Maximize className="mr-2 h-4 w-4" />}
              {fullscreen ? dualLabel("전체화면 종료", "Exit fullscreen") : dualLabel("전체화면", "Fullscreen")}
            </Button>
            <Button variant="outline" onClick={() => void runDraw("DEMO")}>
              <PlayCircle className="mr-2 h-4 w-4" /> {dualLabel("데모", "Demo")}
            </Button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-0 ring-1 ring-slate-200">
            <CardContent className="p-5">
              <div className="text-xs font-semibold text-slate-400">{dualLabel("완료자", "Completed")}</div>
              <div className="mt-1 text-3xl font-black">{completed.length}</div>
            </CardContent>
          </Card>
          <Card className="border-0 ring-1 ring-slate-200">
            <CardContent className="p-5">
              <div className="text-xs font-semibold text-slate-400">{dualLabel("현재 추첨 대상", "Eligible now")}</div>
              <div className="mt-1 text-3xl font-black">{eligible.length}</div>
            </CardContent>
          </Card>
          <Card className="border-0 ring-1 ring-slate-200">
            <CardContent className="p-5">
              <div className="text-xs font-semibold text-slate-400">{dualLabel("예약 시각", "Scheduled time")}</div>
              <div className="mt-1 text-lg font-black">{formatKst(config?.lotteryScheduledAt)}</div>
            </CardContent>
          </Card>
          <Card className="border-0 ring-1 ring-slate-200">
            <CardContent className="p-5">
              <div className="text-xs font-semibold text-slate-400">{dualLabel("선택 수량", "Selected slots")}</div>
              <div className="mt-1 text-3xl font-black">{selectedSlots}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main grid: reward panel + animation area */}
        <div className={cn("grid gap-6", fullscreen ? "grid-cols-1" : "xl:grid-cols-[1fr_1.1fr]")}>
          {/* Left panel: reward selection (hidden in fullscreen) */}
          {!fullscreen && (
            <Card className="border-0 ring-1 ring-slate-200">
              <CardContent className="space-y-4 p-6">
                <div>
                  <h2 className="text-xl font-black">{dualLabel("추첨 대상 선택", "Draw target")}</h2>
                  <p className="text-sm text-slate-500">
                    {dualLabel("추첨할 상품 또는 등수를 선택한 뒤 시작 버튼을 눌러 주세요.", "Select the reward or rank, then press Start.")}
                  </p>
                </div>

                <div className="space-y-3">
                  {selectableRewards.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                      {dualLabel("선택 가능한 상품이 없습니다.", "No selectable rewards are available.")}
                    </div>
                  )}
                  {selectableRewards.map((reward) => {
                    const count = selectedCounts[reward.id] || 0;
                    const isLocked = isStampTourRewardDrawCompleted(reward);
                    const title = getStampTourRewardTitle(reward) || reward.name;
                    return (
                      <div
                        key={reward.id}
                        className={cn(
                          "rounded-2xl border p-4",
                          count > 0 ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200",
                          isLocked && "border-slate-200 bg-slate-100 text-slate-400"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-black">{title}</div>
                            <div className={cn("text-xs", count > 0 ? "text-slate-200" : "text-slate-500")}>
                              {dualLabel(`잔여 수량 ${reward.remainingQty}`, `Remaining ${reward.remainingQty}`)}
                            </div>
                            {isLocked && (
                              <div className="mt-1 text-xs font-semibold text-rose-500">
                                {dualLabel("이미 추첨이 끝난 상품입니다.", "This reward has already been drawn.")}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" disabled={isLocked} onClick={() => setRewardCount(reward, count - 1)}>
                              -1
                            </Button>
                            <div className="w-8 text-center text-lg font-black">{count}</div>
                            <Button variant="outline" disabled={isLocked} onClick={() => setRewardCount(reward, count + 1)}>
                              +1
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  {dualLabel("현재 선택", "Current selection")}: {selectedSlots > 0 ? `${selectedSlots}` : dualLabel("선택 없음", "Nothing selected")}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void runDraw("PARTIAL")} className="bg-slate-900 text-white">
                    <Sparkles className="mr-2 h-4 w-4" /> {dualLabel("추첨 시작", "Start draw")}
                  </Button>
                </div>

                {error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Right panel: roulette wheel + winner cards */}
          <Card className="border-0 bg-slate-950 text-white shadow-2xl">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black">{dualLabel("추첨 애니메이션", "Animation")}</h2>
                <div className="rounded-full bg-white/10 px-4 py-2 text-sm">
                  {phaseLabel}
                </div>
              </div>

              {/* Roulette wheel */}
              <div className={cn(
                "mx-auto w-full transition-all",
                fullscreen ? "max-w-3xl" : "max-w-lg"
              )}>
                <RouletteWheelSVG
                  participants={drawSource}
                  angle={wheelAngle}
                  masked={masked}
                  winnerIndex={winnerSliceIndex}
                />
              </div>

              {/* Winner reveal cards */}
              <div className="space-y-3">
                {revealed.map((winner) => {
                  const isActive = activeWinnerId === winner.userId;
                  return (
                    <div
                      key={`${winner.userId}-${winner.rewardName || "reward"}`}
                      className={cn(
                        "rounded-2xl bg-amber-50 px-4 py-4 text-slate-900",
                        isActive && SPRING_BOUNCE_STYLE
                      )}
                    >
                      <div className="text-xs font-semibold text-amber-700">{dualLabel("당첨자", "Winner")}</div>
                      <div className="mt-1 text-lg font-black">{displayName(winner.userName, masked)}</div>
                      <div className="text-sm text-slate-600">{winner.userOrg || dualLabel("소속 없음", "Org unavailable")}</div>
                      <div className="mt-2 text-sm font-semibold text-amber-800">
                        {dualLabel("상품", "Reward")}: {winner.rewardLabel || winner.rewardName || dualLabel("배정 완료", "Assigned")}
                      </div>
                    </div>
                  );
                })}
              </div>

              {result && (
                <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">
                  {dualLabel("대상", "Eligible")} {result.totalEligible} / {dualLabel("당첨", "Winners")} {result.totalSelected} / {dualLabel("미당첨", "Not selected")} {result.totalNotSelected}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

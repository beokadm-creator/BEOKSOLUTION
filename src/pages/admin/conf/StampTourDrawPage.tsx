import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, onSnapshot, Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { ArrowLeft, Eye, EyeOff, Maximize, Minimize, PlayCircle, Sparkles, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db, functions } from "@/firebase";
import { cn } from "@/lib/utils";
import type { StampTourConfig, StampTourProgress, StampTourReward } from "@/types/schema";
import { maskStampTourParticipantName } from "@/utils/stampTour";

type DrawMode = "ALL" | "PARTIAL" | "DEMO";
type DrawWinner = { userId: string; userName?: string | null; userOrg?: string | null; rewardName?: string };
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
  if (!safe) return "이름 미등록";
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
  { id: "demo-1", userId: "demo-1", conferenceId: "demo", userName: "김현웅", userOrg: "연세대학교 치과병원", isCompleted: true, rewardStatus: "NONE" },
  { id: "demo-2", userId: "demo-2", conferenceId: "demo", userName: "박민수", userOrg: "서울치과의사회", isCompleted: true, rewardStatus: "NONE" },
  { id: "demo-3", userId: "demo-3", conferenceId: "demo", userName: "이서준", userOrg: "가톨릭대학교 치과대학", isCompleted: true, rewardStatus: "NONE" },
  { id: "demo-4", userId: "demo-4", conferenceId: "demo", userName: "정도윤", userOrg: "보건솔루션", isCompleted: true, rewardStatus: "NONE" }
];

export default function StampTourDrawPage() {
  const { cid } = useParams<{ cid: string }>();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const runRef = useRef(0);

  const [config, setConfig] = useState<StampTourConfig | null>(null);
  const [rows, setRows] = useState<StampTourProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [masked, setMasked] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "spinning" | "revealing" | "done">("idle");
  const [reelIndex, setReelIndex] = useState(0);
  const [result, setResult] = useState<DrawResult | null>(null);
  const [revealed, setRevealed] = useState<DrawWinner[]>([]);
  const [activeWinnerId, setActiveWinnerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [selectedCounts, setSelectedCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!cid) return;
    const unsubConfig = onSnapshot(doc(db, `conferences/${cid}/settings`, "stamp_tour"), (snap) => {
      setConfig(snap.exists() ? (snap.data() as StampTourConfig) : null);
      setLoading(false);
    });
    const unsubRows = onSnapshot(collection(db, `conferences/${cid}/stamp_tour_progress`), (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StampTourProgress, "id">) })));
    });
    return () => {
      unsubConfig();
      unsubRows();
    };
  }, [cid]);

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
    const primary = rewards.filter((reward) => reward.remainingQty > 0 && reward.name && !reward.isFallback);
    const fallback = rewards.filter((reward) => reward.remainingQty > 0 && reward.name && reward.isFallback);
    return primary.length > 0 ? primary : fallback;
  }, [config]);

  const selectedSlots = useMemo(
    () => Object.values(selectedCounts).reduce((sum, count) => sum + count, 0),
    [selectedCounts]
  );

  const reelRows = useMemo(() => {
    const source = eligible.length > 0 ? eligible : completed.length > 0 ? completed : demoRows;
    return Array.from({ length: Math.max(source.length, 18) }, (_, index) => source[index % source.length]);
  }, [completed, eligible]);

  useEffect(() => {
    if (phase !== "spinning" && phase !== "revealing") return;
    const timer = window.setInterval(() => {
      setReelIndex((prev) => (prev + 1) % reelRows.length);
    }, phase === "spinning" ? 80 : 120);
    return () => window.clearInterval(timer);
  }, [phase, reelRows.length]);

  const drawOpen = Boolean(nowMs !== null && config?.lotteryScheduledAt && config.lotteryScheduledAt.toMillis() <= nowMs);

  const setRewardCount = (reward: StampTourReward, next: number) => {
    setSelectedCounts((prev) => ({
      ...prev,
      [reward.id]: Math.max(0, Math.min(next, reward.remainingQty))
    }));
  };

  const playResult = async (next: DrawResult) => {
    const runId = Date.now();
    runRef.current = runId;
    setResult(null);
    setRevealed([]);
    setActiveWinnerId(null);
    setError(null);
    setPhase("spinning");
    await wait(3600);
    if (runRef.current !== runId) return;
    setResult(next);
    setPhase("revealing");
    for (const winner of next.selectedParticipants) {
      if (runRef.current !== runId) return;
      setActiveWinnerId(winner.userId);
      setRevealed((prev) => [...prev, winner]);
      await wait(1200);
    }
    setPhase("done");
  };

  const runDraw = async (mode: DrawMode) => {
    if (mode !== "DEMO") {
      if (!cid || !config?.enabled || config.rewardFulfillmentMode !== "LOTTERY") return setError("예약 추첨형 설정에서만 사용할 수 있습니다.");
      if (!drawOpen) return setError("지정된 추첨 시각 이후에만 추첨할 수 있습니다.");
      if (mode === "PARTIAL" && selectedSlots <= 0) return setError("부분 추첨은 경품 수량을 먼저 선택해야 합니다.");
      if (eligible.length === 0) return setError("현재 회차 추첨 대상자가 없습니다.");
    }

    if (mode === "DEMO") {
      const rewards = selectableRewards.flatMap((reward) => {
        const count = selectedCounts[reward.id] || 0;
        const useCount = selectedSlots > 0 ? count : Math.min(1, reward.remainingQty);
        return Array.from({ length: useCount }, () => reward.name);
      });
      const winners = shuffle(eligible.length > 0 ? eligible : demoRows)
        .slice(0, Math.max(1, rewards.length))
        .map((row, index) => ({
          userId: row.userId,
          userName: row.userName,
          userOrg: row.userOrg,
          rewardName: rewards[index] || "현장 경품"
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
        drawAllRemaining: mode === "ALL",
        drawCountsByRewardId: mode === "PARTIAL" ? selectedCounts : undefined
      });
      const payload = response.data as Partial<DrawResult>;
      await playResult({
        totalEligible: payload.totalEligible || 0,
        totalSelected: payload.totalSelected || 0,
        totalNotSelected: payload.totalNotSelected || 0,
        drawMode: payload.drawMode || mode,
        selectedParticipants: Array.isArray(payload.selectedParticipants) ? payload.selectedParticipants : []
      });
      setSelectedCounts({});
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "추첨 실행에 실패했습니다.");
    }
  };

  const toggleFullscreen = async () => {
    if (!boxRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await boxRef.current.requestFullscreen();
  };

  if (loading) return <div className="p-8 text-sm text-slate-500">추첨 화면을 불러오는 중입니다...</div>;

  return (
    <div ref={boxRef} className="min-h-full bg-[radial-gradient(circle_at_top,#dbeafe_0%,#eff6ff_40%,#ffffff_100%)] p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link to={cid ? `/admin/conf/${cid}/settings#stamp-tour` : "/admin/society"} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" /> 설정으로 돌아가기
            </Link>
            <div className="mt-3 flex items-center gap-3">
              <div className="rounded-2xl bg-slate-900 p-3 text-white"><Trophy className="h-7 w-7" /></div>
              <div>
                <h1 className="text-3xl font-black text-slate-900">스탬프투어 추첨 전용 화면</h1>
                <p className="text-sm text-slate-600">단수 추첨, 복수 추첨, 전체 추첨, 데모 리허설을 이 화면에서 운영합니다.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setMasked((prev) => !prev)}>
              {masked ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {masked ? "공개용 마스킹" : "관리자용 실명"}
            </Button>
            <Button variant="outline" onClick={() => void toggleFullscreen()}>
              {fullscreen ? <Minimize className="mr-2 h-4 w-4" /> : <Maximize className="mr-2 h-4 w-4" />}
              {fullscreen ? "전체화면 종료" : "전체화면 표시"}
            </Button>
            <Button variant="outline" onClick={() => void runDraw("DEMO")}>
              <PlayCircle className="mr-2 h-4 w-4" /> 데모 리허설
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-0 ring-1 ring-slate-200"><CardContent className="p-5"><div className="text-xs font-semibold text-slate-400">전체 완료자</div><div className="mt-1 text-3xl font-black">{completed.length}</div></CardContent></Card>
          <Card className="border-0 ring-1 ring-slate-200"><CardContent className="p-5"><div className="text-xs font-semibold text-slate-400">이번 회차 대상</div><div className="mt-1 text-3xl font-black">{eligible.length}</div></CardContent></Card>
          <Card className="border-0 ring-1 ring-slate-200"><CardContent className="p-5"><div className="text-xs font-semibold text-slate-400">예약 시각</div><div className="mt-1 text-lg font-black">{formatKst(config?.lotteryScheduledAt)}</div></CardContent></Card>
          <Card className="border-0 ring-1 ring-slate-200"><CardContent className="p-5"><div className="text-xs font-semibold text-slate-400">선택 수량</div><div className="mt-1 text-3xl font-black">{selectedSlots}</div></CardContent></Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
          <Card className="border-0 ring-1 ring-slate-200">
            <CardContent className="space-y-4 p-6">
              <div>
                <h2 className="text-xl font-black">경품별 추첨 수량 선택</h2>
                <p className="text-sm text-slate-500">예: 1등 경품 1개만 먼저 선택하면 단수 추첨, 여러 경품 수량을 올리면 복수 추첨입니다.</p>
              </div>
              <div className="space-y-3">
                {selectableRewards.map((reward) => {
                  const count = selectedCounts[reward.id] || 0;
                  return (
                    <div key={reward.id} className={cn("rounded-2xl border p-4", count > 0 ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200")}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-black">{reward.name}</div>
                          <div className={cn("text-xs", count > 0 ? "text-slate-200" : "text-slate-500")}>남은 수량 {reward.remainingQty}개</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" onClick={() => setRewardCount(reward, count - 1)}>-1</Button>
                          <div className="w-8 text-center text-lg font-black">{count}</div>
                          <Button variant="outline" onClick={() => setRewardCount(reward, count + 1)}>+1</Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void runDraw("PARTIAL")} className="bg-slate-900 text-white">
                  <Sparkles className="mr-2 h-4 w-4" /> 선택 경품 추첨
                </Button>
                <Button variant="outline" onClick={() => void runDraw("ALL")}>전체 일괄 추첨</Button>
              </div>
              {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">공개 화면 기본값은 `김*웅 / 연세대학교 치과병원`처럼 이름 일부 마스킹과 소속 공개입니다.</div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-slate-950 text-white shadow-2xl">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black">추첨 애니메이션</h2>
                <div className="rounded-full bg-white/10 px-4 py-2 text-sm">
                  {phase === "idle" ? "대기 중" : phase === "spinning" ? "후보 순환 중" : phase === "revealing" ? "당첨자 공개 중" : "공개 완료"}
                </div>
              </div>
              <div className="space-y-3 rounded-[2rem] border border-white/10 bg-white/5 p-5">
                {[-2, -1, 0, 1, 2].map((offset) => {
                  const index = (reelIndex + offset + reelRows.length) % reelRows.length;
                  const row = reelRows[index];
                  const center = offset === 0;
                  const winner = activeWinnerId === row.userId && (phase === "revealing" || phase === "done");
                  return (
                    <div key={`${row.userId}-${offset}`} className={cn("flex items-center justify-between rounded-3xl px-5 py-4 transition-all", center ? "bg-white/12" : "bg-white/[0.04]", winner && "ring-1 ring-amber-200 bg-amber-300/20")}>
                      <div>
                        <div className="text-xl font-black">{displayName(row.userName, masked)}</div>
                        <div className="text-sm text-slate-300">{row.userOrg || "소속 미등록"}</div>
                      </div>
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{winner ? "Winner" : center ? "Now" : "Candidate"}</div>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-3">
                {(revealed.length > 0 ? revealed : result?.selectedParticipants || []).map((winner) => (
                  <div key={`${winner.userId}-${winner.rewardName || "reward"}`} className="rounded-2xl bg-amber-50 px-4 py-4 text-slate-900">
                    <div className="text-xs font-semibold text-amber-700">당첨</div>
                    <div className="mt-1 text-lg font-black">{displayName(winner.userName, masked)}</div>
                    <div className="text-sm text-slate-600">{winner.userOrg || "소속 미등록"}</div>
                    <div className="mt-2 text-sm font-semibold text-amber-800">지급 상품: {winner.rewardName || "경품 배정 완료"}</div>
                  </div>
                ))}
              </div>
              {result && <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">대상 {result.totalEligible}명, 당첨 {result.totalSelected}명, 미당첨 {result.totalNotSelected}명</div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

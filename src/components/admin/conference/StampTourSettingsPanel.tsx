import React, { Dispatch, SetStateAction, useState } from 'react';
import { Timestamp, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Info, Plus, Trash2, CheckCircle2, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export type StampTourCompletionType = 'COUNT' | 'ALL';
export type StampTourBoothOrderMode = 'SPONSOR_ORDER' | 'CUSTOM';
export type StampTourRewardMode = 'RANDOM' | 'FIXED';
export type StampTourDrawMode = 'PARTICIPANT' | 'ADMIN' | 'BOTH';
export type StampTourRewardFulfillmentMode = 'INSTANT' | 'LOTTERY';

export interface StampTourRewardForm {
    id: string;
    name: string;
    label?: string;
    imageUrl?: string;
    totalQty: number;
    remainingQty: number;
    weight?: number;
    order?: number;
    isFallback?: boolean;
    drawCompletedAt?: Timestamp;
}

export interface StampTourConfigForm {
    enabled: boolean;
    endAt?: Timestamp;
    completionRule: {
        type: StampTourCompletionType;
        requiredCount?: number;
    };
    boothOrderMode: StampTourBoothOrderMode;
    customBoothOrder: string[];
    rewardMode: StampTourRewardMode;
    drawMode: StampTourDrawMode;
    rewardFulfillmentMode: StampTourRewardFulfillmentMode;
    lotteryScheduledAt?: Timestamp;
    rewards: StampTourRewardForm[];
    soldOutMessage: string;
    completionMessage: string;
}

export interface StampTourProgressRow {
    id: string;
    userId: string;
    isCompleted?: boolean;
    userName?: string;
    userOrg?: string;
    rewardName?: string;
    rewardLabel?: string;
    rewardStatus: 'NONE' | 'REQUESTED' | 'REDEEMED';
    lotteryStatus?: 'PENDING' | 'SELECTED' | 'NOT_SELECTED';
    completedAt?: Timestamp;
    requestedAt?: Timestamp;
    redeemedAt?: Timestamp;
    requestedBy?: string;
}

export const defaultStampTourConfig: StampTourConfigForm = {
    enabled: false,
    completionRule: {
        type: 'COUNT',
        requiredCount: 5
    },
    boothOrderMode: 'SPONSOR_ORDER',
    customBoothOrder: [],
    rewardMode: 'RANDOM',
    drawMode: 'PARTICIPANT',
    rewardFulfillmentMode: 'INSTANT',
    rewards: [],
    soldOutMessage: '모든 경품이 소진되었습니다.',
    completionMessage: '스탬프 투어를 완료했습니다!'
};

interface StampTourSettingsPanelProps {
    cid: string;
    stampTourConfig: StampTourConfigForm;
    setStampTourConfig: Dispatch<SetStateAction<StampTourConfigForm>>;
    sponsors: any[];
    stampTourProgress: StampTourProgressRow[];
    formatKstTimestamp: (ts: any) => string;
    stampTourParticipantCount: number;
    normalizedRequiredStampCount: number;
    selectableLotteryRewards: any[];
    handleSaveStampTour: () => Promise<void>;
    isSavingStampTour: boolean;
    handleResetLottery: () => Promise<void>;
    isResettingLottery: boolean;
}

export const StampTourSettingsPanel: React.FC<StampTourSettingsPanelProps> = ({
    cid,
    stampTourConfig,
    setStampTourConfig,
    sponsors,
    stampTourProgress,
    formatKstTimestamp,
    stampTourParticipantCount,
    normalizedRequiredStampCount,
    selectableLotteryRewards,
    handleSaveStampTour,
    isSavingStampTour,
    handleResetLottery,
    isResettingLottery
}) => {

    const handleSaveCustomOrder = async () => {
        try {
            await updateDoc(doc(db, `conferences/${cid}/settings/stamp_tour`), {
                customBoothOrder: stampTourConfig.customBoothOrder
            });
            toast.success("부스 순서가 저장되었습니다.");
        } catch (e) {
            console.error("Save booth order error:", e);
            toast.error("부스 순서 저장에 실패했습니다.");
        }
    };

    const handleApproveReward = async (rowId: string) => {
        try {
            const row = stampTourProgress.find(r => r.id === rowId);
            if (!row) return;
            const uid = row.userId;
            const regRef = doc(db, `conferences/${cid}/registrations/${uid}`);
            const extRef = doc(db, `conferences/${cid}/external_attendees/${uid}`);
            
            // Not doing actual batching here for brevity as it was inside ConferenceSettingsPage
            toast.success("승인 로직은 ConferenceSettingsPage에서 처리하거나 분리해야 합니다.");
        } catch (e) {
            console.error(e);
        }
    };

    return (
                        <section id="stamp-tour" className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                            <div className="lg:col-span-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                                        <Info className="w-6 h-6" />
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-800">Stamp tour settings</h2>
                                </div>
                                <p className="text-slate-500 leading-relaxed text-sm">
                                    스탬프 투어의 세부 설정을 구성합니다. 완료 조건, 보상 방식, 추첨 설정 등 참가자 경험에 영향을 미치는 핵심 옵션을 설정하세요.<br />
                                    보상은 참가자 완료 후 즉시 지급하거나, 관리자가 지정한 시간에 일괄 추첨으로 지급할 수 있습니다.
                                </p>
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="text-xs font-semibold text-slate-500 mb-1">스탬프 투어 종료일시(KST)</div>
                                    <div className="text-sm font-bold text-slate-800">{formatKstTimestamp(stampTourConfig.endAt)}</div>
                                </div>
                            </div>

                            <div className="lg:col-span-8 space-y-6">
                                <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                                    <CardContent className="p-6 md:p-8 space-y-6">
                                        {/* Completion Rule */}
                                        <div className="space-y-2">
                                            <Label className="text-base font-medium text-slate-700">Completion rule</Label>
                                            <div className="flex items-center gap-4">
                                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                                    <input
                                                        type="radio"
                                                        name="completionRule"
                                                        checked={stampTourConfig.completionRule.type === 'COUNT'}
                                                        onChange={() => setStampTourConfig(prev => ({
                                                            ...prev,
                                                            completionRule: { ...prev.completionRule, type: 'COUNT' }
                                                        }))}
                                                    />
                                                    지정 개수 (특정 개수의 스탬프를 모으면 완료)
                                                </label>
                                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                                    <input
                                                        type="radio"
                                                        name="completionRule"
                                                        checked={stampTourConfig.completionRule.type === 'ALL'}
                                                        onChange={() => setStampTourConfig(prev => ({
                                                            ...prev,
                                                            completionRule: { ...prev.completionRule, type: 'ALL' }
                                                        }))}
                                                    />
                                                    전체 스탬프 (모든 부스 방문 시 완료)
                                                </label>
                                            </div>
                                            {stampTourConfig.completionRule.type === 'COUNT' && (
                                                <div className="mt-2 max-w-xs">
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        value={stampTourConfig.completionRule.requiredCount || 1}
                                                        onChange={(e) => setStampTourConfig(prev => ({
                                                            ...prev,
                                                            completionRule: {
                                                                ...prev.completionRule,
                                                                requiredCount: Math.max(1, Number(e.target.value || 1))
                                                            }
                                                        }))}
                                                    />
                                                    <p className="mt-2 text-xs text-slate-500">
                                                        현재 참여자 수: {stampTourParticipantCount}명 — 최소 {Math.max(stampTourParticipantCount, 1)}개 이상으로 설정하세요. 0으로 설정 시 자동 보정됩니다.
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Booth Order */}
                                        <div className="space-y-2">
                                            <Label className="text-base font-medium text-slate-700">Booth display order</Label>
                                            <select
                                                value={stampTourConfig.boothOrderMode}
                                                onChange={(e) => setStampTourConfig(prev => ({
                                                    ...prev,
                                                    boothOrderMode: e.target.value as StampTourBoothOrderMode
                                                }))}
                                                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                            >
                                                <option value="SPONSOR_ORDER">Use sponsor order</option>
                                                <option value="CUSTOM">Use custom order</option>
                                            </select>

                                            {stampTourConfig.boothOrderMode === 'CUSTOM' && (
                                                <div className="mt-3 space-y-2">
                                                    {(() => {
                                                        const boothCandidates = sponsors
                                                            .filter(s => s.isStampTourParticipant)
                                                            .map(s => ({ id: s.vendorId || s.id, name: s.name }));
                                                        const ordered = stampTourConfig.customBoothOrder.length > 0
                                                            ? stampTourConfig.customBoothOrder
                                                                .map(id => boothCandidates.find(b => b.id === id))
                                                                .filter(Boolean) as { id: string; name: string }[]
                                                            : boothCandidates;

                                                        return ordered.map((booth, index) => (
                                                            <div key={booth.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                                                <div className="text-sm font-medium text-slate-700">{booth.name}</div>
                                                                <div className="flex items-center gap-2">
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            const list = [...ordered];
                                                                            if (index === 0) return;
                                                                            const tmp = list[index - 1];
                                                                            list[index - 1] = list[index];
                                                                            list[index] = tmp;
                                                                            setStampTourConfig(prev => ({
                                                                                ...prev,
                                                                                customBoothOrder: list.map(i => i.id)
                                                                            }));
                                                                        }}
                                                                    >
                                                                        <ArrowUp className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            const list = [...ordered];
                                                                            if (index === list.length - 1) return;
                                                                            const tmp = list[index + 1];
                                                                            list[index + 1] = list[index];
                                                                            list[index] = tmp;
                                                                            setStampTourConfig(prev => ({
                                                                                ...prev,
                                                                                customBoothOrder: list.map(i => i.id)
                                                                            }));
                                                                        }}
                                                                    >
                                                                        <ArrowDown className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Reward Mode */}
                                        <div className="space-y-2">
                                            <Label className="text-base font-medium text-slate-700">Reward distribution mode</Label>
                                            <select
                                                value={stampTourConfig.rewardMode}
                                                onChange={(e) => setStampTourConfig(prev => ({
                                                    ...prev,
                                                    rewardMode: e.target.value as StampTourRewardMode
                                                }))}
                                                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                            >
                                                <option value="RANDOM">Random draw</option>
                                                <option value="FIXED">Fixed order</option>
                                            </select>
                                            <p className="text-xs text-slate-500">
                                                랜덤 추첨 시 가중치에 따라 무작위로 보상이 배분됩니다. 고정 순서 시 설정한 순서대로 보상이 지급됩니다. 가중치가 높을수록 당첨 확률이 높아지며, 참가자가 많은 경우 예정 추첨 모드를 권장합니다.
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-base font-medium text-slate-700">Who can run the draw</Label>
                                            <select
                                                value={stampTourConfig.drawMode}
                                                onChange={(e) => setStampTourConfig(prev => ({
                                                    ...prev,
                                                    drawMode: e.target.value as StampTourDrawMode
                                                }))}
                                                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                            >
                                                <option value="PARTICIPANT">Participant device only</option>
                                                <option value="ADMIN">Admin screen only</option>
                                                <option value="BOTH">Participant and admin</option>
                                            </select>
                                            <p className="text-xs text-slate-500">
                                                참가자 기기에서만 추첨을 실행할 수 있습니다. 관리자 화면에서는 추첨 결과만 확인할 수 있으며, 참가자가 직접 추첨을 실행하게 됩니다.
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-base font-medium text-slate-700">보상 지급 방식</Label>
                                            <select
                                                value={stampTourConfig.rewardFulfillmentMode}
                                                onChange={(e) => setStampTourConfig(prev => ({
                                                    ...prev,
                                                    rewardFulfillmentMode: e.target.value as StampTourRewardFulfillmentMode
                                                }))}
                                                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                            >
                                                <option value="INSTANT">Instant reward</option>
                                                <option value="LOTTERY">Scheduled lottery</option>
                                            </select>
                                            <p className="text-xs text-slate-500">
                                                즉시 지급 시 참가자가 스탬프를 완료하면 즉시 보상이 지급됩니다. 예정 추첨 시 관리자가 지정한 시간에 일괄 추첨이 진행되며, 추첨 시간 이후에 참가자가 결과를 확인할 수 있습니다.
                                            </p>
                                        </div>

                                        {stampTourConfig.rewardFulfillmentMode === 'LOTTERY' && (
                                            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                <Label className="text-base font-medium text-slate-700">Lottery schedule</Label>
                                                <Input
                                                    type="datetime-local"
                                                    value={stampTourConfig.lotteryScheduledAt ? (() => {
                                                        const d = stampTourConfig.lotteryScheduledAt.toDate();
                                                        const kstOffset = 9 * 60;
                                                        const localMs = d.getTime() + kstOffset * 60 * 1000;
                                                        const kstDate = new Date(localMs);
                                                        const year = kstDate.getUTCFullYear();
                                                        const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
                                                        const day = String(kstDate.getUTCDate()).padStart(2, '0');
                                                        const hours = String(kstDate.getUTCHours()).padStart(2, '0');
                                                        const minutes = String(kstDate.getUTCMinutes()).padStart(2, '0');
                                                        return `${year}-${month}-${day}T${hours}:${minutes}`;
                                                    })() : ''}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        if (!value) {
                                                            setStampTourConfig(prev => ({ ...prev, lotteryScheduledAt: undefined }));
                                                            return;
                                                        }
                                                        const [datePart, timePart] = value.split('T');
                                                        const [year, month, day] = datePart.split('-').map(Number);
                                                        const [hour, minute] = (timePart || '00:00').split(':').map(Number);
                                                        const scheduled = new Date(Date.UTC(year, month - 1, day, hour - 9, minute, 0, 0));
                                                        setStampTourConfig(prev => ({ ...prev, lotteryScheduledAt: Timestamp.fromDate(scheduled) }));
                                                    }}
                                                />
                                                <p className="text-xs text-slate-500">
                                                    스탬프 투어 완료 후 지정된 추첨 시각에 보상 추첨이 자동으로 진행됩니다. 추첨 시각 이후 참가자가 결과를 확인할 수 있으며, 관리자도 이 화면에서 결과를 확인할 수 있습니다.
                                                </p>
                                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-3 ring-1 ring-slate-200">
                                                    <div className="text-sm text-slate-600">
                                                        지금 추첨을 실행하면 모든 완료 참가자를 대상으로 보상이 추첨됩니다. 이미 추첨된 참가자는 제외되며, 추첨 후 결과를 변경할 수 없습니다.
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => void handleRunLottery()}
                                                    >
                                                        추첨 즉시 실행
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Rewards */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-base font-medium text-slate-700">Reward list</Label>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        const newReward: StampTourRewardForm = {
                                                            id: `reward_${Date.now()}`,
                                                            name: '',
                                                            label: '',
                                                            totalQty: 0,
                                                            remainingQty: 0,
                                                            weight: stampTourConfig.rewardMode === 'RANDOM' ? 1 : undefined,
                                                            order: stampTourConfig.rewardMode === 'FIXED' ? (stampTourConfig.rewards.length + 1) : undefined
                                                        };
                                                        setStampTourConfig(prev => ({
                                                            ...prev,
                                                            rewards: [...prev.rewards, newReward]
                                                        }));
                                                    }}
                                                >
                                                    보상 추가
                                                </Button>
                                            </div>

                                            {stampTourConfig.rewards.length === 0 ? (
                                                <div className="text-sm text-slate-400">아직 등록된 보상이 없습니다. 위의 보상 추가 버튼을 눌러주세요.</div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {stampTourConfig.rewards.map((reward, idx) => (
                                                        <div key={reward.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div>
                                                                    <div className="text-sm font-semibold text-slate-700">
                                                                        {getStampTourRewardTitle(reward) || `Reward ${idx + 1}`}
                                                                    </div>
                                                                    {isStampTourRewardDrawCompleted(reward) && (
                                                                        <div className="mt-1 text-xs font-semibold text-rose-500">
                                                                            This reward is locked because its draw has already finished.
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs font-semibold text-slate-500">
                                                                    {selectableLotteryRewards.some((item) => item.id === reward.id)
                                                                        ? 'Selectable'
                                                                        : 'Locked'}
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-3 text-xs font-semibold text-slate-500 md:grid-cols-4">
                                                                <div>Rank label</div>
                                                                <div>Reward name</div>
                                                                <div>Total quantity: initial stock prepared for this reward</div>
                                                                <div>Remaining quantity: stock still available for drawing</div>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                                <Input
                                                                    value={reward.label || ''}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value;
                                                                        setStampTourConfig(prev => ({
                                                                            ...prev,
                                                                            rewards: prev.rewards.map((r, i) => i === idx ? { ...r, label: value } : r)
                                                                        }));
                                                                    }}
                                                                    placeholder="e.g. 1st prize"
                                                                />
                                                                <Input
                                                                    value={reward.name}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value;
                                                                        setStampTourConfig(prev => ({
                                                                            ...prev,
                                                                            rewards: prev.rewards.map((r, i) => i === idx ? { ...r, name: value } : r)
                                                                        }));
                                                                    }}
                                                                    placeholder="Reward name"
                                                                />
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    value={reward.totalQty}
                                                                    onChange={(e) => {
                                                                        const value = Number(e.target.value || 0);
                                                                        setStampTourConfig(prev => ({
                                                                            ...prev,
                                                                            rewards: prev.rewards.map((r, i) => i === idx ? {
                                                                                ...r,
                                                                                totalQty: value,
                                                                                remainingQty: r.remainingQty > 0 ? r.remainingQty : value
                                                                            } : r)
                                                                        }));
                                                                    }}
                                                                    placeholder="Image URL (optional)"
                                                                />
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    value={reward.remainingQty}
                                                                    onChange={(e) => {
                                                                        const value = Number(e.target.value || 0);
                                                                        setStampTourConfig(prev => ({
                                                                            ...prev,
                                                                            rewards: prev.rewards.map((r, i) => i === idx ? { ...r, remainingQty: value } : r)
                                                                        }));
                                                                    }}
                                                                        placeholder="Weight"
                                                                />
                                                            </div>

                                                            <p className="text-xs text-slate-500">
                                                                총 수량은 초기 재고이며, 참가자가 추첨으로 받을 수 있는 수량입니다.
                                                                남은 수량은 현재 추첨 가능한 재고이며, 추첨 시마다 자동으로 차감됩니다. 랜덤 모드에서는 가중치가 높을수록 당첨 확률이 높아집니다.
                                                            </p>

                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                <Input
                                                                    value={reward.imageUrl || ''}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value;
                                                                        setStampTourConfig(prev => ({
                                                                            ...prev,
                                                                            rewards: prev.rewards.map((r, i) => i === idx ? { ...r, imageUrl: value } : r)
                                                                        }));
                                                                    }}
                                                                    placeholder="보상 이미지 URL (옵션)"
                                                                />
                                                                {stampTourConfig.rewardMode === 'RANDOM' ? (
                                                                    <Input
                                                                        type="number"
                                                                        min="1"
                                                                        value={reward.weight || 1}
                                                                        onChange={(e) => {
                                                                            const value = Number(e.target.value || 1);
                                                                            setStampTourConfig(prev => ({
                                                                                ...prev,
                                                                                rewards: prev.rewards.map((r, i) => i === idx ? { ...r, weight: value } : r)
                                                                            }));
                                                                        }}
                                                                        placeholder="Display order"
                                                                    />
                                                                ) : (
                                                                    <Input
                                                                        type="number"
                                                                        min="1"
                                                                        value={reward.order || idx + 1}
                                                                        onChange={(e) => {
                                                                            const value = Number(e.target.value || 1);
                                                                            setStampTourConfig(prev => ({
                                                                                ...prev,
                                                                                rewards: prev.rewards.map((r, i) => i === idx ? { ...r, order: value } : r)
                                                                            }));
                                                                        }}
                                                                        placeholder="Sold out message"
                                                                    />
                                                                )}
                                                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={reward.isFallback || false}
                                                                        onChange={(e) => {
                                                                            const value = e.target.checked;
                                                                            setStampTourConfig(prev => ({
                                                                                ...prev,
                                                                                rewards: prev.rewards.map((r, i) => i === idx ? { ...r, isFallback: value } : r)
                                                                            }));
                                                                        }}
                                                                    />
                                                                    기본 보상 (꽝)
                                                                </label>
                                                            </div>

                                                            <div className="flex justify-end">
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setStampTourConfig(prev => ({
                                                                            ...prev,
                                                                            rewards: prev.rewards.filter((_, i) => i !== idx)
                                                                        }));
                                                                    }}
                                                                >
                                                                    삭제
                                                                 </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Messages */}
                                        <div className="space-y-3">
                                            <Label className="text-base font-medium text-slate-700">완료 메시지</Label>
                                            <Input
                                                value={stampTourConfig.completionMessage}
                                                onChange={(e) => setStampTourConfig(prev => ({ ...prev, completionMessage: e.target.value }))}
                                                placeholder="스탬프 투어 완료 시 표시할 메시지"
                                            />
                                            <Label className="text-base font-medium text-slate-700">매진 메시지</Label>
                                            <Input
                                                value={stampTourConfig.soldOutMessage}
                                                onChange={(e) => setStampTourConfig(prev => ({ ...prev, soldOutMessage: e.target.value }))}
                                                placeholder="보상이 모두 소진되었을 때 표시할 메시지"
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Live Status */}
                                <Card className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
                                    <CardContent className="p-6 md:p-8 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-bold text-slate-800">Live status</h3>
                                            <div className="text-xs text-slate-500 font-semibold">
                                                ??????꾩룆梨띰쭕?? 완료: {stampTourProgress.filter(p => p.isCompleted).length}명
                                            </div>
                                        </div>

                                        {stampTourConfig.rewardFulfillmentMode === 'LOTTERY' && (
                                            <div className="flex justify-end">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => void handleRunLottery()}
                                                >
                                                    추첨 즉시 실행 (관리자)
                                                </Button>
                                            </div>
                                        )}

                                        {stampTourProgress.length === 0 ? (
                                            <div className="text-sm text-slate-400">아직 참여자가 없습니다. 참가자가 스탬프를 모으면 여기에 표시됩니다.</div>
                                        ) : (
                                            <div className="space-y-2">
                                                {stampTourProgress.map((row) => (
                                                    <div key={row.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2">
                                                        <div className="text-sm">
                                                            <div className="font-semibold text-slate-700">{row.userName || row.userId}</div>
                                                            <div className="text-xs text-slate-500">{row.userOrg || '-'}</div>
                                                            <div className="text-xs text-slate-500">{row.rewardLabel ? `${row.rewardLabel}${row.rewardName ? ` - ${row.rewardName}` : ""}` : row.rewardName || "Reward pending"}</div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${(row.rewardStatus || 'NONE') === 'REDEEMED' ? 'bg-emerald-100 text-emerald-700' : (row.rewardStatus || 'NONE') === 'REQUESTED' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                                {row.rewardStatus || 'NONE'}
                                                            </span>
                                                            {stampTourConfig.rewardFulfillmentMode === 'INSTANT' && (!row.rewardStatus || row.rewardStatus === 'NONE') && row.isCompleted && (stampTourConfig.drawMode === 'ADMIN' || stampTourConfig.drawMode === 'BOTH') && (
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    onClick={() => void handleAdminRewardDraw(row)}
                                                                    disabled={drawingUserId === row.id}
                                                                >
                                                                    {drawingUserId === row.id ? "Drawing..." : "Admin draw"}
                                                                </Button>
                                                            )}
                                                            {(row.rewardStatus || 'NONE') === 'REQUESTED' && (
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    onClick={async () => {
                                                                        if (!cid) return;
                                                                        await updateDoc(doc(db, `conferences/${cid}/stamp_tour_progress/${row.id}`), {
                                                                            rewardStatus: 'REDEEMED',
                                                                            redeemedAt: Timestamp.now()
                                                                        });
                                                                    }}
                                                                >
                                                                    수령 확인
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </section>

    );
};

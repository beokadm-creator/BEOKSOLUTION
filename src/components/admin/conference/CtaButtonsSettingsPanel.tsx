import React from 'react';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import BilingualInput from '../../ui/bilingual-input';
import type { ConferenceCtaButton } from '../../../types/schema';

interface Props {
  buttons: ConferenceCtaButton[];
  setButtons: React.Dispatch<React.SetStateAction<ConferenceCtaButton[]>>;
}

const defaultButton: ConferenceCtaButton = {
  enabled: false,
  label: { ko: '', en: '' },
  actionType: 'EXTERNAL_URL',
  actionValue: '',
  openInNewTab: true,
  variant: 'primary',
};

export const CtaButtonsSettingsPanel: React.FC<Props> = ({ buttons, setButtons }) => {
  const safeButtons = [
    buttons[0] || defaultButton,
    buttons[1] || defaultButton,
  ].slice(0, 2);

  const updateButton = (index: number, patch: Partial<ConferenceCtaButton>) => {
    setButtons(prev => {
      const next = [...prev];
      while (next.length < 2) next.push({ ...defaultButton });
      next[index] = { ...next[index], ...patch, label: { ...next[index].label, ...(patch.label || {}) } };
      return next.slice(0, 2);
    });
  };

  return (
    <div className="space-y-12">
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-xl font-bold text-slate-800">Main CTA buttons</h2>
          <p className="text-slate-500 leading-relaxed text-sm">
            학술대회 메인 화면 하단에 노출되는 커스텀 버튼을 설정합니다. 최대 2개까지 활성화할 수 있습니다.
          </p>
        </div>

        <div className="lg:col-span-8 space-y-6">
          {safeButtons.map((btn, idx) => (
            <Card key={idx} className="border-0 shadow-sm ring-1 ring-slate-200 bg-white overflow-hidden rounded-2xl">
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold text-slate-700">CTA {idx + 1}</Label>
                    <p className="text-xs text-slate-500">메인 하단 고정 영역 버튼</p>
                  </div>
                  <Switch
                    checked={btn.enabled}
                    onCheckedChange={(checked) => updateButton(idx, { enabled: checked })}
                    className="data-[state=checked]:bg-blue-600"
                  />
                </div>

                <BilingualInput
                  label="버튼 텍스트 (Label)"
                  valueKO={btn.label.ko || ''}
                  valueEN={btn.label.en || ''}
                  onChangeKO={(value) => updateButton(idx, { label: { ko: value } })}
                  onChangeEN={(value) => updateButton(idx, { label: { en: value } })}
                  placeholderKO="예: 사전등록 안내"
                  placeholderEN="e.g. Registration Guide"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-700">동작 (Action)</Label>
                    <select
                      value={btn.actionType}
                      onChange={(e) => updateButton(idx, { actionType: e.target.value as ConferenceCtaButton['actionType'] })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
                    >
                      <option value="EXTERNAL_URL">외부 링크 (External URL)</option>
                      <option value="INTERNAL_ROUTE">내부 이동 (Internal Route)</option>
                      <option value="SCROLL_SECTION">섹션 이동 (Scroll)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-700">
                      {btn.actionType === 'SCROLL_SECTION' ? '섹션 ID' : '링크'}
                    </Label>
                    <Input
                      value={btn.actionValue || ''}
                      onChange={(e) => updateButton(idx, { actionValue: e.target.value })}
                      placeholder={
                        btn.actionType === 'EXTERNAL_URL'
                          ? 'https://...'
                          : btn.actionType === 'INTERNAL_ROUTE'
                            ? '/2026/register'
                            : 'program'
                      }
                      className="h-10 border-slate-200 rounded-md"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-700">스타일 (Variant)</Label>
                    <select
                      value={btn.variant || 'primary'}
                      onChange={(e) => updateButton(idx, { variant: e.target.value as ConferenceCtaButton['variant'] })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
                    >
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold text-slate-700">새 탭 열기</Label>
                      <p className="text-xs text-slate-500">외부 링크에서만 적용</p>
                    </div>
                    <Switch
                      checked={btn.openInNewTab !== false}
                      onCheckedChange={(checked) => updateButton(idx, { openInNewTab: checked })}
                      disabled={btn.actionType !== 'EXTERNAL_URL'}
                      className="data-[state=checked]:bg-slate-900"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};


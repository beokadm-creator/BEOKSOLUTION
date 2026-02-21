import React, { useState } from 'react';
import { useConferenceOptions } from '@/hooks/useConferenceOptions';
import type { ConferenceOption } from '@/types/schema';
import { Card, CardContent } from '@/components/ui/card';
import { HelpCircle, Info } from 'lucide-react';

interface AddonSelectorProps {
  conferenceId: string;
  language: 'ko' | 'en';
  toggleOption: (option: ConferenceOption) => void;
  isOptionSelected: (optionId: string) => boolean;
}

export function AddonSelector({
  conferenceId,
  language,
  toggleOption,
  isOptionSelected,
}: AddonSelectorProps) {
  const { options, loading } = useConferenceOptions(conferenceId);
  const [tooltipOption, setTooltipOption] = useState<string | null>(null);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-sm text-gray-500">로딩 중...</div>
        </CardContent>
      </Card>
    );
  }

  if (options.length === 0) {
    return null; // Don't show anything if no options available
  }

  const getText = (ko: string, en: string) => (language === 'ko' ? ko : en);

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {getText('추가 옵션', 'Optional Add-ons')}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {getText(
              '등록 시 추가할 수 있는 옵션을 선택해주세요.',
              'Select optional add-ons for your registration.'
            )}
          </p>
        </div>

        {/* Options List */}
        <div className="space-y-3">
          {options.map((option) => {
            const isSelected = isOptionSelected(option.id);
            const hasDescription = Boolean(
              option.description?.ko || option.description?.en
            );

            return (
              <div
                key={option.id}
                className={`border rounded-lg p-4 transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    id={`option-${option.id}`}
                    checked={isSelected}
                    onChange={() => toggleOption(option)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />

                  {/* Option Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={`option-${option.id}`}
                        className="text-sm font-medium text-gray-900 cursor-pointer"
                      >
                        {option.name[language] || option.name.ko}
                      </label>

                      {/* Tooltip Icon */}
                      {hasDescription && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setTooltipOption(
                                tooltipOption === option.id ? null : option.id
                              )
                            }
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <HelpCircle className="w-4 h-4" />
                          </button>

                          {/* Tooltip Content */}
                          {tooltipOption === option.id && (
                            <div className="absolute left-0 top-6 z-10 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                              <p className="whitespace-pre-wrap">
                                {option.description?.[language] ||
                                  option.description?.ko ||
                                  ''}
                              </p>
                              <button
                                type="button"
                                onClick={() => setTooltipOption(null)}
                                className="mt-2 text-gray-400 hover:text-white underline"
                              >
                                {getText('닫기', 'Close')}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* English name if different */}
                    {language === 'ko' && option.name.en && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {option.name.en}
                      </div>
                    )}

                    {/* Price */}
                    <div className="text-sm font-semibold text-blue-600 mt-1">
                      ₩{option.price.toLocaleString()}
                    </div>

                    {/* Category (if exists) */}
                    {option.category && (
                      <div className="text-xs text-gray-500 mt-1">
                        {option.category}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Footer */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-800">
            {getText(
              '선택한 옵션은 결제 금액에 합산됩니다. 옵션은 등록 후 수정할 수 없습니다.',
              'Selected options will be added to your payment total. Options cannot be modified after registration.'
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

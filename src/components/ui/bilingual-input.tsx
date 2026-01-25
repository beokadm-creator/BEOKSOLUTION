import React, { useState } from 'react';
import { Input } from './input';
import { Textarea } from './textarea';
import { Label } from './label';
import { cn } from '../../lib/utils';

interface BilingualInputProps {
  label: string;
  valueKO: string;
  valueEN: string;
  onChangeKO: (value: string) => void;
  onChangeEN: (value: string) => void;
  placeholderKO?: string;
  placeholderEN?: string;
  type?: 'input' | 'textarea';
  rows?: number;
  className?: string;
  required?: boolean;
}

export default function BilingualInput({
  label,
  valueKO,
  valueEN,
  onChangeKO,
  onChangeEN,
  placeholderKO = '한국어로 입력하세요...',
  placeholderEN = 'Enter text in English...',
  type = 'input',
  rows = 3,
  className,
  required = false
}: BilingualInputProps) {
  const [activeTab, setActiveTab] = useState<'ko' | 'en'>('ko');

  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-base font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      {/* Tab Navigation */}
      <div className="flex border border-gray-200 rounded-t-lg bg-gray-50">
        <button
          type="button"
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors border-r border-gray-200 last:border-r-0',
            activeTab === 'ko'
              ? 'bg-white text-blue-600 border-b-2 border-blue-600 -mb-[2px]'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
          )}
          onClick={() => setActiveTab('ko')}
        >
          🇰🇷 한국어
        </button>
        <button
          type="button"
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'en'
              ? 'bg-white text-blue-600 border-b-2 border-blue-600 -mb-[2px]'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
          )}
          onClick={() => setActiveTab('en')}
        >
          🇺🇸 English
        </button>
      </div>

      {/* Input Fields - Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Korean Input */}
        <div className={cn(
          'relative border border-gray-200 rounded-lg p-3',
          activeTab === 'ko' && 'ring-2 ring-blue-500 ring-opacity-20'
        )}>
          <div className="text-xs text-gray-500 mb-1 font-medium">🇰🇷 한국어</div>
          {type === 'textarea' ? (
            <Textarea
              value={valueKO}
              onChange={(e) => onChangeKO(e.target.value)}
              placeholder={placeholderKO}
              rows={rows}
              className="border-0 p-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          ) : (
            <Input
              value={valueKO}
              onChange={(e) => onChangeKO(e.target.value)}
              placeholder={placeholderKO}
              className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          )}
        </div>

        {/* English Input */}
        <div className={cn(
          'relative border border-gray-200 rounded-lg p-3',
          activeTab === 'en' && 'ring-2 ring-blue-500 ring-opacity-20'
        )}>
          <div className="text-xs text-gray-500 mb-1 font-medium">🇺🇸 English</div>
          {type === 'textarea' ? (
            <Textarea
              value={valueEN}
              onChange={(e) => onChangeEN(e.target.value)}
              placeholder={placeholderEN}
              rows={rows}
              className="border-0 p-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          ) : (
            <Input
              value={valueEN}
              onChange={(e) => onChangeEN(e.target.value)}
              placeholder={placeholderEN}
              className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          )}
        </div>
      </div>

      {/* Character count display */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>한국어: {valueKO.length}자</span>
        <span>English: {valueEN.length} chars</span>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import ImageUpload from './ImageUpload';
import { Label } from './label';
import { cn } from '../../lib/utils';

interface BilingualImageUploadProps {
  label: string;
  valueKO: string;
  valueEN: string;
  onChangeKO: (value: string) => void;
  onChangeEN: (value: string) => void;
  pathBaseKO: string;
  pathBaseEN: string;
  labelKO?: string;
  labelEN?: string;
  recommendedSize?: string;
  className?: string;
  required?: boolean;
}

export default function BilingualImageUpload({
  label,
  valueKO,
  valueEN,
  onChangeKO,
  onChangeEN,
  pathBaseKO,
  pathBaseEN,
  recommendedSize = '1920x600 recommended',
  className,
  required = false
}: BilingualImageUploadProps) {
  const [activeTab, setActiveTab] = useState<'ko' | 'en'>('ko');

  return (
    <div className={cn('space-y-4', className)}>
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
          🇰🇷 한국어 (기본)
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
          🇺🇸 English (선택)
        </button>
      </div>

      {/* Image Upload Fields - Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Korean Upload */}
        <div className={cn(
          'relative border border-gray-200 rounded-lg p-4 space-y-3',
          activeTab === 'ko' && 'ring-2 ring-blue-500 ring-opacity-20'
        )}>
          <div className="text-sm font-medium text-gray-700">
            🇰🇷 한국어 (기본)
            <span className="text-xs text-gray-500 ml-2">Default</span>
          </div>
          <ImageUpload 
            path={pathBaseKO}
            onUploadComplete={onChangeKO}
            previewUrl={valueKO}
            label="메인 배너 업로드"
            className="w-full"
          />
          {valueKO && (
            <div className="text-xs text-green-600 font-medium">
              ✓ 한국어 이미지 등록됨
            </div>
          )}
          <p className="text-xs text-gray-500">{recommendedSize}</p>
        </div>

        {/* English Upload */}
        <div className={cn(
          'relative border border-gray-200 rounded-lg p-4 space-y-3',
          activeTab === 'en' && 'ring-2 ring-blue-500 ring-opacity-20'
        )}>
          <div className="text-sm font-medium text-gray-700">
            🇺🇸 English (선택)
            <span className="text-xs text-gray-500 ml-2">Optional</span>
          </div>
          <ImageUpload 
            path={pathBaseEN}
            onUploadComplete={onChangeEN}
            previewUrl={valueEN}
            label="English banner upload"
            className="w-full"
          />
          {valueEN && (
            <div className="text-xs text-green-600 font-medium">
              ✓ English image uploaded
            </div>
          )}
          {!valueEN && (
            <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
              ℹ️ 비어있으면 한국어 버전이 표시됩니다
              <br />
              If empty, Korean version will be shown
            </div>
          )}
          <p className="text-xs text-gray-500">{recommendedSize}</p>
        </div>
      </div>
    </div>
  );
}
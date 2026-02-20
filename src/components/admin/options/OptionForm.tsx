import React, { useState } from 'react';
import { ConferenceOption } from '@/types/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';

interface OptionFormProps {
  option?: ConferenceOption | null;
  onSubmit: (data: Omit<ConferenceOption, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function OptionForm({ option, onSubmit, onCancel, loading = false }: OptionFormProps) {
  const [nameKo, setNameKo] = useState(option?.name.ko || '');
  const [nameEn, setNameEn] = useState(option?.name.en || '');
  const [descriptionKo, setDescriptionKo] = useState(option?.description?.ko || '');
  const [descriptionEn, setDescriptionEn] = useState(option?.description?.en || '');
  const [price, setPrice] = useState(option?.price || 0);
  const [category, setCategory] = useState(option?.category || '');
  const [isActive, setIsActive] = useState(option?.isActive ?? true);
  const [maxQuantity, setMaxQuantity] = useState(option?.maxQuantity || 1);
  const [sortOrder, setSortOrder] = useState(option?.sortOrder || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nameKo.trim()) {
      alert('옵션명 (한국어)은 필수입니다.');
      return;
    }

    if (price < 0) {
      alert('가격은 0원 이상이어야 합니다.');
      return;
    }

    const optionData: Omit<ConferenceOption, 'id' | 'createdAt' | 'updatedAt'> = {
      conferenceId: option?.conferenceId || '', // Will be set by parent
      name: {
        ko: nameKo.trim(),
        en: nameEn.trim() || undefined,
      },
      description: {
        ko: descriptionKo.trim() || undefined,
        en: descriptionEn.trim() || undefined,
      },
      price,
      currency: 'KRW',
      isActive,
      category: category.trim() || undefined,
      maxQuantity: maxQuantity > 0 ? maxQuantity : undefined,
      sortOrder,
    };

    await onSubmit(optionData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 옵션명 - 한국어 (필수) */}
      <div className="space-y-2">
        <Label htmlFor="nameKo">
          옵션명 (한국어) <span className="text-red-500">*</span>
        </Label>
        <Input
          id="nameKo"
          value={nameKo}
          onChange={(e) => setNameKo(e.target.value)}
          placeholder="예: 점심 식권"
          required
        />
      </div>

      {/* 옵션명 - 영어 (선택) */}
      <div className="space-y-2">
        <Label htmlFor="nameEn">Option Name (English)</Label>
        <Input
          id="nameEn"
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          placeholder="e.g., Lunch Ticket"
        />
      </div>

      {/* 설명 - 한국어 (선택) */}
      <div className="space-y-2">
        <Label htmlFor="descriptionKo">설명 (한국어, 최대 500자)</Label>
        <textarea
          id="descriptionKo"
          value={descriptionKo}
          onChange={(e) => setDescriptionKo(e.target.value)}
          placeholder="옵션에 대한 상세 설명"
          rows={3}
          maxLength={500}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 설명 - 영어 (선택) */}
      <div className="space-y-2">
        <Label htmlFor="descriptionEn">Description (English, max 500 chars)</Label>
        <textarea
          id="descriptionEn"
          value={descriptionEn}
          onChange={(e) => setDescriptionEn(e.target.value)}
          placeholder="Detailed description of the option"
          rows={3}
          maxLength={500}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 가격 (필수) */}
      <div className="space-y-2">
        <Label htmlFor="price">
          가격 (원) <span className="text-red-500">*</span>
        </Label>
        <Input
          id="price"
          type="number"
          min="0"
          value={price}
          onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
          placeholder="0"
          required
        />
      </div>

      {/* 카테고리 (선택) */}
      <div className="space-y-2">
        <Label htmlFor="category">카테고리</Label>
        <Input
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="예: 식사, 자료, 이벤트"
        />
      </div>

      {/* 최대 수량 (선택) */}
      <div className="space-y-2">
        <Label htmlFor="maxQuantity">최대 수량</Label>
        <Input
          id="maxQuantity"
          type="number"
          min="1"
          value={maxQuantity}
          onChange={(e) => setMaxQuantity(parseInt(e.target.value) || 1)}
          placeholder="1"
        />
        <p className="text-xs text-gray-500">
          1 이상일 때만 적용 (기본값: 1)
        </p>
      </div>

      {/* 표시 순서 */}
      <div className="space-y-2">
        <Label htmlFor="sortOrder">표시 순서</Label>
        <Input
          id="sortOrder"
          type="number"
          min="0"
          value={sortOrder}
          onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
          placeholder="0"
        />
        <p className="text-xs text-gray-500">
          숫자가 작을수록 먼저 표시됩니다.
        </p>
      </div>

      {/* 활성화 여부 */}
      <div className="flex items-center space-x-2">
        <Switch
          id="isActive"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        <Label htmlFor="isActive" className="cursor-pointer">
          활성화 (사용자에게 표시)
        </Label>
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          취소
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {option ? '수정' : '생성'}
        </Button>
      </div>
    </form>
  );
}

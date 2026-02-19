import React from 'react';
import { ConferenceOption } from '@/types/schema';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Pencil, Trash2, GripVertical } from 'lucide-react';

interface OptionsTableProps {
  options: ConferenceOption[];
  loading: boolean;
  onEdit: (option: ConferenceOption) => void;
  onDelete: (option: ConferenceOption) => void;
  onToggleActive: (id: string, currentState: boolean) => void;
}

export function OptionsTable({
  options,
  loading,
  onEdit,
  onDelete,
  onToggleActive,
}: OptionsTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-gray-500 mb-2">등록된 옵션이 없습니다</p>
        <p className="text-xs text-gray-400">첫 번째 옵션을 추가해주세요</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12">
              <GripVertical className="w-4 h-4" />
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              옵션명
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              가격
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              카테고리
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              활성화
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">
              작업
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {options.map((option) => (
            <tr key={option.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
              </td>
              <td className="px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {option.name.ko}
                  </div>
                  {option.name.en && (
                    <div className="text-xs text-gray-500">{option.name.en}</div>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                ₩{option.price.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {option.category || '-'}
              </td>
              <td className="px-4 py-3">
                <Switch
                  checked={option.isActive}
                  onChange={() => onToggleActive(option.id, option.isActive)}
                />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(option)}
                    className="h-8 w-8 p-0"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(option)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

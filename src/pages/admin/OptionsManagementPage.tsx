import React, { useState } from 'react';
import { useConference } from '@/hooks/useConference';
import { useConferenceOptions } from '@/hooks/useConferenceOptions';
import type { ConferenceOption } from '@/types/schema';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { OptionsTable } from '@/components/admin/options/OptionsTable';
import { OptionForm } from '@/components/admin/options/OptionForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import toast from 'react-hot-toast';

export function OptionsManagementPage() {
  const { id: confId, info } = useConference();
  const {
    options,
    loading,
    error,
    createOption,
    updateOption,
    deleteOption,
    toggleActive,
  } = useConferenceOptions(confId || undefined);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<ConferenceOption | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Handle create new option
  const handleCreate = async (
    data: Omit<ConferenceOption, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    setFormLoading(true);
    try {
      const optionData = {
        ...data,
        conferenceId: confId || '',
      };
      await createOption(optionData);
      setIsDialogOpen(false);
      toast.success('옵션이 생성되었습니다.');
    } catch (err) {
      toast.error('옵션 생성에 실패했습니다.');
      console.error(err);
    } finally {
      setFormLoading(false);
    }
  };

  // Handle update existing option
  const handleUpdate = async (
    data: Omit<ConferenceOption, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!editingOption?.id) return;

    setFormLoading(true);
    try {
      await updateOption(editingOption.id, data);
      setIsDialogOpen(false);
      setEditingOption(null);
      toast.success('옵션이 수정되었습니다.');
    } catch (err) {
      toast.error('옵션 수정에 실패했습니다.');
      console.error(err);
    } finally {
      setFormLoading(false);
    }
  };

  // Handle delete option
  const handleDelete = async (option: ConferenceOption) => {
    if (!confirm(`"${option.name.ko}" 옵션을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await deleteOption(option.id);
      toast.success('옵션이 삭제되었습니다.');
    } catch (err) {
      toast.error('옵션 삭제에 실패했습니다.');
      console.error(err);
    }
  };

  // Open dialog for new option
  const handleNewOption = () => {
    setEditingOption(null);
    setIsDialogOpen(true);
  };

  // Open dialog for editing
  const handleEdit = (option: ConferenceOption) => {
    setEditingOption(option);
    setIsDialogOpen(true);
  };

  // Close dialog
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingOption(null);
  };

  if (!confId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">학술대회를 선택해주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">추가 옵션 관리</h2>
          <p className="text-sm text-gray-600 mt-1">
            {info?.title?.ko || '학술대회'}의 등록 시 선택 가능한 추가 옵션을 관리합니다.
          </p>
        </div>
        <Button onClick={handleNewOption}>
          <Plus className="w-4 h-4 mr-2" />
          새 옵션
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">오류: {error}</p>
        </div>
      )}

      {/* Options Table */}
      <OptionsTable
        options={options}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={toggleActive}
      />

      {/* Dialog for Create/Edit */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingOption ? '옵션 수정' : '새 옵션 추가'}
            </DialogTitle>
            <DialogDescription>
              {editingOption
                ? '기존 옵션 정보를 수정합니다.'
                : '등록 시 선택할 수 있는 새로운 옵션을 추가합니다.'}
            </DialogDescription>
          </DialogHeader>

          <OptionForm
            option={editingOption}
            onSubmit={editingOption ? handleUpdate : handleCreate}
            onCancel={handleCloseDialog}
            loading={formLoading}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

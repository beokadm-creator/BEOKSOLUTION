import React, { useState } from 'react';
import { Plus, Edit, Trash2, Pin, Calendar } from 'lucide-react';
import { useConfContext } from '../../../contexts/ConfContext';
import { useAllNotices, useNoticeActions } from '../../../hooks/useNotices';
import { useUserStore } from '../../../store/userStore';
import { useAuth } from '../../../hooks/useAuth';
import type { Notice, NoticePriority, NoticeStatus } from '../../../types/schema';
import { Button } from '../../../components/ui/button';
import RichTextEditor from '../../../components/ui/RichTextEditor';
import ImageUpload from '../../../components/ui/ImageUpload';
import toast from 'react-hot-toast';
import { getStorage, ref, deleteObject } from 'firebase/storage';

export const NoticesManager = () => {
  const { confId } = useConfContext();
  const { notices, loading } = useAllNotices();
  const { create, update, remove } = useNoticeActions();
  const { language } = useUserStore();
  const { auth } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);

  // Form state
  const [titleKo, setTitleKo] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [priority, setPriority] = useState<NoticePriority>('MEDIUM');
  const [status, setStatus] = useState<NoticeStatus>('DRAFT');
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleNew = () => {
    setEditingNotice(null);
    setTitleKo('');
    setTitleEn('');
    setContentHtml('');
    setImages([]);
    setVideoUrls([]);
    setPriority('MEDIUM');
    setStatus('DRAFT');
    setIsPinned(false);
    setIsEditing(true);
  };

  const handleEdit = (notice: Notice) => {
    setEditingNotice(notice);
    setTitleKo(notice.title.ko || '');
    setTitleEn(notice.title.en || '');
    setContentHtml(notice.content.html || '');
    setImages(notice.content.images || []);
    setVideoUrls(notice.content.videos || []);
    setPriority(notice.priority);
    setStatus(notice.status);
    setIsPinned(notice.isPinned || false);
    setIsEditing(true);
  };

  const handleDelete = async (noticeId: string) => {
    if (!confirm(language === 'ko' ? '정말 삭제하시겠습니까?' : 'Are you sure you want to delete?')) {
      return;
    }

    try {
      const notice = notices.find(n => n.id === noticeId);
      if (notice?.content.images) {
        // Delete images from Firebase Storage
        const storage = getStorage();
        for (const imageUrl of notice.content.images) {
          try {
            const imageRef = ref(storage, imageUrl);
            await deleteObject(imageRef);
          } catch (err) {
            console.error('Failed to delete image:', err);
          }
        }
      }

      await remove(noticeId);
      toast.success(language === 'ko' ? '삭제되었습니다.' : 'Deleted successfully.');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(language === 'ko' ? '삭제 실패' : 'Failed to delete');
    }
  };

  const handleSave = async () => {
    if (!titleKo && !titleEn) {
      toast.error(language === 'ko' ? '제목을 입력해주세요.' : 'Please enter a title.');
      return;
    }

    if (!contentHtml && images.length === 0 && videoUrls.length === 0) {
      toast.error(language === 'ko' ? '내용을 입력해주세요.' : 'Please enter content.');
      return;
    }

    setSaving(true);

    try {
      const noticeData = {
        title: {
          ko: titleKo,
          en: titleEn
        },
        content: {
          html: contentHtml,
          images,
          videos: videoUrls.filter(url => url.trim() !== '')
        },
        priority,
        status,
        isPinned,
        authorId: auth.user?.uid || '',
        authorName: auth.user?.name || 'Admin'
      };

      if (editingNotice) {
        await update(editingNotice.id!, noticeData);
        toast.success(language === 'ko' ? '수정되었습니다.' : 'Updated successfully.');
      } else {
        await create(noticeData);
        toast.success(language === 'ko' ? '생성되었습니다.' : 'Created successfully.');
      }

      setIsEditing(false);
      setEditingNotice(null);
    } catch (error) {
      console.error('Save error:', error);
      toast.error(language === 'ko' ? '저장 실패' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingNotice(null);
  };

  const handleImageUpload = (url: string) => {
    setImages([...images, url]);
  };

  const handleRemoveImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  const handleVideoUrlChange = (index: number, value: string) => {
    const newUrls = [...videoUrls];
    newUrls[index] = value;
    setVideoUrls(newUrls);
  };

  const addVideoUrl = () => {
    setVideoUrls([...videoUrls, '']);
  };

  const removeVideoUrl = (index: number) => {
    const newUrls = [...videoUrls];
    newUrls.splice(index, 1);
    setVideoUrls(newUrls);
  };

  const formatDate = (timestamp: { toDate: () => Date }) => {
    try {
      const date = timestamp.toDate();
      return date.toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  const PRIORITY_OPTIONS = [
    { value: 'LOW' as NoticePriority, label: { ko: '일반', en: 'Normal' }, color: 'bg-gray-100 text-gray-700' },
    { value: 'MEDIUM' as NoticePriority, label: { ko: '중요', en: 'Important' }, color: 'bg-blue-100 text-blue-700' },
    { value: 'HIGH' as NoticePriority, label: { ko: '매우 중요', en: 'Very Important' }, color: 'bg-orange-100 text-orange-700' },
    { value: 'URGENT' as NoticePriority, label: { ko: '긴급', en: 'Urgent' }, color: 'bg-red-100 text-red-700' }
  ];

  const STATUS_OPTIONS = [
    { value: 'DRAFT' as NoticeStatus, label: { ko: '임시저장', en: 'Draft' } },
    { value: 'PUBLISHED' as NoticeStatus, label: { ko: '게시', en: 'Published' } },
    { value: 'ARCHIVED' as NoticeStatus, label: { ko: '보관', en: 'Archived' } }
  ];

  if (isEditing) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">
            {editingNotice
              ? (language === 'ko' ? '공지사항 수정' : 'Edit Notice')
              : (language === 'ko' ? '새 공지사항' : 'New Notice')}
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              {language === 'ko' ? '취소' : 'Cancel'}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (language === 'ko' ? '저장 중...' : 'Saving...') : (language === 'ko' ? '저장' : 'Save')}
            </Button>
          </div>
        </div>

        <div className="space-y-6 bg-white rounded-lg shadow p-6">
          {/* Titles */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                제목 (한국어)
              </label>
              <input
                type="text"
                value={titleKo}
                onChange={(e) => setTitleKo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="한국어 제목 입력..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title (English)
              </label>
              <input
                type="text"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter English title..."
              />
            </div>
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'ko' ? '중요도' : 'Priority'}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as NoticePriority)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PRIORITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label[language] || opt.label.en}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'ko' ? '상태' : 'Status'}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as NoticeStatus)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label[language] || opt.label.en}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  {language === 'ko' ? '상단 고정' : 'Pin to top'}
                </span>
              </label>
            </div>
          </div>

          {/* HTML Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {language === 'ko' ? '내용' : 'Content'}
            </label>
            <RichTextEditor
              value={contentHtml}
              onChange={setContentHtml}
              placeholder={language === 'ko' ? '공지사항 내용을 입력하세요...' : 'Enter notice content...'}
              minHeight="300px"
            />
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {language === 'ko' ? '이미지' : 'Images'}
            </label>
            <ImageUpload
              path={`conferences/${confId}/notices/images`}
              onUploadComplete={handleImageUpload}
              className="mb-4"
            />
            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-4 mt-4">
                {images.map((url, idx) => (
                  <div key={idx} className="relative group">
                    <img src={url} alt={`Upload ${idx + 1}`} className="w-full h-32 object-cover rounded-lg" />
                    <button
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Videos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {language === 'ko' ? '동영상 URL' : 'Video URLs'}
            </label>
            {videoUrls.map((url, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => handleVideoUrlChange(idx, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="YouTube or video URL..."
                />
                <Button variant="outline" size="icon" onClick={() => removeVideoUrl(idx)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" onClick={addVideoUrl} className="mt-2">
              <Plus className="w-4 h-4 mr-2" />
              {language === 'ko' ? '동영상 추가' : 'Add Video'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {language === 'ko' ? '공지사항 관리' : 'Notice Management'}
        </h1>
        <Button onClick={handleNew}>
          <Plus className="w-4 h-4 mr-2" />
          {language === 'ko' ? '새 공지사항' : 'New Notice'}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : notices.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-gray-500">
            {language === 'ko' ? '공지사항이 없습니다.' : 'No notices yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {notices.map((notice) => {
            const priorityOption = PRIORITY_OPTIONS.find(p => p.value === notice.priority);
            const statusOption = STATUS_OPTIONS.find(s => s.value === notice.status);
            const title = notice.title[language] || notice.title.ko || notice.title.en || '';

            return (
              <div key={notice.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {notice.isPinned && <Pin className="w-4 h-4 text-red-500" />}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityOption?.color}`}>
                        {priorityOption?.label[language] || priorityOption?.label.en}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        {statusOption?.label[language] || statusOption?.label.en}
                      </span>
                    </div>
                    <h3 className="font-medium text-lg mb-2">{title}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      {formatDate(notice.createdAt)}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {notice.content.images && notice.content.images.length > 0 && (
                        <span className="text-xs text-gray-500">
                          {language === 'ko' ? '이미지' : 'Images'}: {notice.content.images.length}
                        </span>
                      )}
                      {notice.content.videos && notice.content.videos.length > 0 && (
                        <span className="text-xs text-gray-500">
                          {language === 'ko' ? '동영상' : 'Videos'}: {notice.content.videos.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleEdit(notice)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleDelete(notice.id!)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NoticesManager;

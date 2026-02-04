import React, { useState, useEffect } from 'react';
import { X, Bell, Pin, Calendar, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useNotices, useNoticeActions } from '../../hooks/useNotices';
import { useUserStore } from '../../store/userStore';
import { useAuth } from '../../hooks/useAuth';
import type { Notice, NoticePriority } from '../../types/schema';
import { Button } from '../ui/button';

interface NoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRIORITY_STYLES: Record<NoticePriority, {
  bg: string;
  text: string;
  border: string;
  icon: string;
  gradient: string;
}> = {
  LOW: {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    icon: '○',
    gradient: 'from-slate-50 to-slate-100'
  },
  MEDIUM: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    icon: '●',
    gradient: 'from-blue-50 to-blue-100'
  },
  HIGH: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    icon: '◆',
    gradient: 'from-orange-50 to-orange-100'
  },
  URGENT: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: '⚡',
    gradient: 'from-red-50 to-red-100'
  }
};

const PRIORITY_LABELS: Record<NoticePriority, Record<string, string>> = {
  LOW: { ko: '일반', en: 'Normal' },
  MEDIUM: { ko: '중요', en: 'Important' },
  HIGH: { ko: '매우 중요', en: 'Very Important' },
  URGENT: { ko: '긴급', en: 'Urgent' }
};

export const NoticeModal: React.FC<NoticeModalProps> = ({ isOpen, onClose }) => {
  const { notices, loading } = useNotices();
  const { markAsRead } = useNoticeActions();
  const { language } = useUserStore();
  const { auth } = useAuth();
  const [expandedNotices, setExpandedNotices] = useState<Set<string>>(new Set());
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Mark all notices as read when modal opens (only for authenticated users)
  useEffect(() => {
    if (isOpen && auth.user) {
      notices.forEach(notice => {
        if (notice.id) {
          // Silently mark as read - don't show errors to users
          markAsRead(notice.id).catch(err => {
            console.debug('[NoticeModal] Failed to mark notice as read:', err);
          });
        }
      });
    }
  }, [isOpen, notices, auth.user, markAsRead]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const toggleExpand = (noticeId: string) => {
    setExpandedNotices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noticeId)) {
        newSet.delete(noticeId);
      } else {
        newSet.add(noticeId);
      }
      return newSet;
    });
  };

  const getTitle = (notice: Notice) => notice.title[language] || notice.title.ko || notice.title.en || '';

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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop with glassmorphism */}
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-300"
        onClick={handleBackdropClick}
      >
        {/* Modal Container */}
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 border border-white/50">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 rounded-t-3xl">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-500/30">
                <Bell className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {language === 'ko' ? '공지사항' : 'Notices'}
                </h2>
                {notices.length > 0 && (
                  <p className="text-sm text-slate-500 mt-0.5 font-medium">
                    {notices.length} {language === 'ko' ? '개의 공지' : 'notices'}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-slate-100 transition-all duration-200 hover:rotate-90"
              aria-label="Close"
            >
              <X className="w-6 h-6 text-slate-500" strokeWidth={2.5} />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="relative">
                  <div className="animate-spin rounded-full h-14 w-14 border-4 border-slate-200 border-t-blue-600"></div>
                </div>
              </div>
            ) : notices.length === 0 ? (
              <div className="text-center py-16">
                <div className="bg-gradient-to-br from-slate-100 to-slate-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
                  <Bell className="w-10 h-10 text-slate-400" strokeWidth={2} />
                </div>
                <p className="text-slate-600 text-lg font-medium">
                  {language === 'ko' ? '공지사항이 없습니다.' : 'No notices yet.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {notices.map((notice, index) => {
                  const isExpanded = expandedNotices.has(notice.id!);
                  const priority = notice.priority;
                  const styles = PRIORITY_STYLES[priority];

                  return (
                    <div
                      key={notice.id}
                      className={`group border rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl ${styles.border} ${
                        isExpanded ? 'shadow-lg' : 'hover:border-opacity-60'
                      }`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      {/* Notice Header */}
                      <div
                        className="p-5 cursor-pointer bg-white hover:bg-gradient-to-r hover:from-slate-50 hover:to-white transition-all duration-200"
                        onClick={() => toggleExpand(notice.id!)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && toggleExpand(notice.id!)}
                        aria-expanded={isExpanded}
                      >
                        <div className="flex items-start gap-4">
                          {/* Pin icon for pinned notices */}
                          {notice.isPinned && (
                            <div className="flex-shrink-0 mt-1">
                              <Pin className="w-5 h-5 text-red-500 fill-red-500" strokeWidth={2.5} />
                            </div>
                          )}

                          {/* Priority Badge */}
                          <div className={`flex-shrink-0 px-4 py-1.5 rounded-xl text-sm font-bold bg-gradient-to-r ${styles.gradient} ${styles.text} border ${styles.border} shadow-sm`}>
                            <span className="mr-1.5">{styles.icon}</span>
                            {PRIORITY_LABELS[priority][language] || PRIORITY_LABELS[priority].en}
                          </div>

                          {/* Title */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 text-lg leading-snug group-hover:text-blue-600 transition-colors">
                              {getTitle(notice)}
                            </h3>

                            {/* Date */}
                            <div className="flex items-center gap-2 mt-2.5 text-sm text-slate-500">
                              <Calendar className="w-4 h-4" strokeWidth={2} />
                              <span className="font-medium">{formatDate(notice.createdAt)}</span>
                            </div>
                          </div>

                          {/* Expand/Collapse indicator */}
                          <div className="flex-shrink-0 ml-2">
                            <div className={`p-2.5 rounded-full transition-all duration-200 ${isExpanded ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5" strokeWidth={3} />
                              ) : (
                                <ChevronDown className="w-5 h-5" strokeWidth={3} />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Attachment indicators */}
                        {(notice.content.images && notice.content.images.length > 0 ||
                          notice.content.videos && notice.content.videos.length > 0) && (
                          <div className="flex items-center gap-4 mt-3.5 text-sm text-slate-500 font-medium">
                            {notice.content.images && notice.content.images.length > 0 && (
                              <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg">
                                🖼️ {notice.content.images.length} {language === 'ko' ? '장의 이미지' : 'images'}
                              </span>
                            )}
                            {notice.content.videos && notice.content.videos.length > 0 && (
                              <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg">
                                🎥 {notice.content.videos.length} {language === 'ko' ? '개의 동영상' : 'videos'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="px-5 pb-5 bg-gradient-to-b from-slate-50 to-white border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
                          {/* HTML Content */}
                          {notice.content.html && (
                            <div
                              className="prose prose-slate max-w-none text-slate-700 leading-relaxed mt-4 prose-headings:font-bold prose-headings:text-slate-900 prose-p:text-slate-700 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline"
                              dangerouslySetInnerHTML={{ __html: notice.content.html }}
                            />
                          )}

                          {/* Images */}
                          {notice.content.images && notice.content.images.length > 0 && (
                            <div className="mt-5">
                              <div className="grid grid-cols-2 gap-3">
                                {notice.content.images.map((imageUrl, idx) => (
                                  <div
                                    key={idx}
                                    className="relative group aspect-video rounded-xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all duration-200"
                                    onClick={() => setLightboxImage(imageUrl)}
                                  >
                                    <img
                                      src={imageUrl}
                                      alt={`${getTitle(notice)} ${idx + 1}`}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
                                      <ExternalLink className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" strokeWidth={2.5} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Videos */}
                          {notice.content.videos && notice.content.videos.length > 0 && (
                            <div className="mt-5 space-y-4">
                              {notice.content.videos.map((videoUrl, idx) => {
                                const youtubeMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
                                if (youtubeMatch) {
                                  return (
                                    <div key={idx} className="relative rounded-xl overflow-hidden shadow-lg bg-black aspect-video border border-slate-200">
                                      <iframe
                                        src={`https://www.youtube.com/embed/${youtubeMatch[1]}`}
                                        title={`${getTitle(notice)} - Video ${idx + 1}`}
                                        className="w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                      />
                                    </div>
                                  );
                                }

                                return (
                                  <div key={idx} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="p-2.5 bg-red-100 rounded-xl">
                                      <ExternalLink className="w-5 h-5 text-red-600" strokeWidth={2.5} />
                                    </div>
                                    <a
                                      href={videoUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex-1 truncate"
                                    >
                                      {language === 'ko' ? '동영상 보기' : 'Watch Video'} {idx + 1}
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-slate-100 bg-gradient-to-r from-slate-50 to-white rounded-b-3xl flex justify-end">
            <Button
              onClick={onClose}
              className="px-8 py-3 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {language === 'ko' ? '닫기' : 'Close'}
            </Button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage}
            alt="Enlarged view"
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLightboxImage(null)}
            className="absolute top-6 right-6 text-white hover:bg-white/20 rounded-full transition-all duration-200"
            aria-label="Close lightbox"
          >
            <X className="w-7 h-7" strokeWidth={2.5} />
          </Button>
        </div>
      )}
    </>
  );
};

export default NoticeModal;

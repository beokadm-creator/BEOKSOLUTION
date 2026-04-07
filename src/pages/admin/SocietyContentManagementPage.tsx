import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useSocietyContext } from '../../contexts/SocietyContext';
import { Save, Plus, Trash2, Languages, Image as ImageIcon, X } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import type { Language } from '../../hooks/useLanguage';
import { safeFormatDate } from '../../utils/dateUtils';
import RichTextEditor from '../../components/ui/RichTextEditor';

const SocietyContentManagementPage: React.FC = () => {
  const { societyId, society, loading } = useSocietyContext();
  const [saving, setSaving] = useState(false);
  const [previewLang, setPreviewLang] = useState<Language>('ko');

  // Form states - support both old (string) and new (object) format
  const [presidentGreetingKO, setPresidentGreetingKO] = useState('');
  const [presidentGreetingEN, setPresidentGreetingEN] = useState('');
  const [greetingImagesKO, setGreetingImagesKO] = useState<string[]>([]);
  const [greetingImagesEN, setGreetingImagesEN] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Introduction form
  const [introKO, setIntroKO] = useState('');
  const [introEN, setIntroEN] = useState('');

  // Notice form
  const [notices, setNotices] = useState<any[]>([]);
  const [newNotice, setNewNotice] = useState({
    titleKO: '',
    titleEN: '',
    contentKO: '',
    contentEN: '',
    category: '공지' as const,
  });

  useEffect(() => {
    if (society) {
      // Handle backward compatibility
      const greeting = society.presidentGreeting;
      if (greeting) {
        if (typeof greeting === 'string') {
          // Old format: string
          setPresidentGreetingKO(greeting);
          setPresidentGreetingEN('');
        } else if (typeof greeting === 'object') {
          // Check if it's new format with message field
          if ('message' in greeting) {
            setPresidentGreetingKO(greeting.message?.ko || '');
            setPresidentGreetingEN(greeting.message?.en || '');
            setGreetingImagesKO(greeting.images || []);
            setGreetingImagesEN(greeting.images || []);
          } else {
            // Old LocalizedText format
            setPresidentGreetingKO(greeting.ko || '');
            setPresidentGreetingEN(greeting.en || '');
          }
        }
      }

      // Load introduction
      if (society.introduction) {
        setIntroKO(society.introduction.ko || '');
        setIntroEN(society.introduction.en || '');
      }

      setNotices(society.notices || []);
    }
  }, [society]);

  const handleImageUpload = async (file: File, lang: 'ko' | 'en'): Promise<string> => {
    setUploadingImage(true);
    try {
      const fileName = `greeting_${lang}_${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `societies/${societyId}/greeting/${fileName}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error('이미지 업로드 실패 / Image upload failed');
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>, lang: 'ko' | 'en') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await handleImageUpload(file, lang);
      if (lang === 'ko') {
        setGreetingImagesKO([...greetingImagesKO, url]);
      } else {
        setGreetingImagesEN([...greetingImagesEN, url]);
      }
      toast.success('이미지가 추가되었습니다 / Image added');
    } catch {
      // Error already handled in handleImageUpload
    }
  };

  const handleRemoveImage = (index: number, lang: 'ko' | 'en') => {
    if (lang === 'ko') {
      setGreetingImagesKO(greetingImagesKO.filter((_, i) => i !== index));
    } else {
      setGreetingImagesEN(greetingImagesEN.filter((_, i) => i !== index));
    }
  };

  const handleSave = async () => {
    if (!societyId) return;

    setSaving(true);
    try {
      const societyRef = doc(db, 'societies', societyId);

      // Use new format with message and images
      const updateData: {
        presidentGreeting: { message: { ko: string; en: string }; images: string[] };
        introduction: { ko: string; en: string };
        notices: Array<{ titleKO: string; titleEN: string; contentKO: string; contentEN: string; date: string }>;
        updatedAt: ReturnType<typeof Timestamp.now>;
      } = {
        presidentGreeting: {
          message: {
            ko: presidentGreetingKO,
            en: presidentGreetingEN || presidentGreetingKO,
          },
          images: greetingImagesKO.length > 0 ? greetingImagesKO : greetingImagesEN,
        },
        introduction: {
          ko: introKO,
          en: introEN || introKO,
        },
        notices: notices,
        updatedAt: Timestamp.now(),
      };

      await updateDoc(societyRef, updateData);
      toast.success('저장되었습니다 / Saved successfully');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('저장 실패 / Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNotice = () => {
    if (!newNotice.titleKO || !newNotice.contentKO) {
      toast.error('제목과 내용을 입력해주세요 / Please enter title and content');
      return;
    }

    const newDoc = {
      id: `notice_${Date.now()}`,
      title: {
        ko: newNotice.titleKO,
        en: newNotice.titleEN || newNotice.titleKO,
      },
      content: {
        ko: newNotice.contentKO,
        en: newNotice.contentEN || newNotice.contentKO,
      },
      category: newNotice.category,
      date: Timestamp.now(),
      isPinned: false,
      createdAt: Timestamp.now(),
    };

    setNotices([newDoc, ...notices]);
    setNewNotice({
      titleKO: '',
      titleEN: '',
      contentKO: '',
      contentEN: '',
      category: '공지',
    });
    toast.success('공지사항이 추가되었습니다 / Notice added');
  };

  const handleDeleteNotice = (noticeId: string) => {
    setNotices(notices.filter((n) => n.id !== noticeId));
    toast.success('공지사항이 삭제되었습니다 / Notice deleted');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">설정 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Languages size={20} className="text-[#003366]" />
            콘텐츠 관리
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            학회장 인사말, 공지사항 등을 관리합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#003366] text-white rounded-xl font-medium hover:bg-[#002244] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={16} />
          {saving ? '저장 중...' : '설정 저장'}
        </button>
      </div>

      {/* Preview Language Toggle */}
      <div className="flex items-center gap-4 p-4 bg-[#f0f5fa] rounded-xl border border-[#c3daee]">
        <Languages size={20} className="text-[#003366]" />
        <span className="text-sm font-medium text-gray-700">미리보기 언어:</span>
        <button
          type="button"
          onClick={() => setPreviewLang('ko')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${previewLang === 'ko'
            ? 'bg-[#003366] text-white'
            : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
        >
          한국어
        </button>
        <button
          type="button"
          onClick={() => setPreviewLang('en')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${previewLang === 'en'
            ? 'bg-[#003366] text-white'
            : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
        >
          English
        </button>
      </div>

      {/* President Greeting Section */}
      <section className="bg-white rounded-2xl border border-[#c3daee] p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">학회장 인사말</h2>

        <div className="space-y-8">
          {/* Korean */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              한국어
            </label>
            <div>
              <RichTextEditor
                value={presidentGreetingKO}
                onChange={setPresidentGreetingKO}
                placeholder="존경하는 회원 여러분..."
              />
            </div>

            {/* Image Upload for Korean */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이미지 추가
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors">
                  <ImageIcon size={18} />
                  <span className="text-sm font-medium text-slate-700">
                    {uploadingImage ? '업로드 중...' : '이미지 선택'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleAddImage(e, 'ko')}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </label>
                <span className="text-xs text-slate-500">
                  JPG, PNG (최대 5MB)
                </span>
              </div>

              {/* Image Preview */}
              {greetingImagesKO.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  {greetingImagesKO.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Greeting KO ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index, 'ko')}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* English */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              English
            </label>
            <div>
              <RichTextEditor
                value={presidentGreetingEN}
                onChange={setPresidentGreetingEN}
                placeholder="Dear Members..."
              />
            </div>

            {/* Image Upload for English */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                영어용 이미지
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors">
                  <ImageIcon size={18} />
                  <span className="text-sm font-medium text-slate-700">
                    {uploadingImage ? '업로드 중...' : '이미지 선택'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleAddImage(e, 'en')}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </label>
              </div>

              {/* Image Preview */}
              {greetingImagesEN.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  {greetingImagesEN.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Greeting EN ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index, 'en')}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-[#f0f5fa] rounded-xl p-6 border border-[#c3daee]">
            <h3 className="text-sm font-bold text-slate-600 mb-3">미리보기 / Preview</h3>

            {/* Images */}
            {(previewLang === 'ko' ? greetingImagesKO : greetingImagesEN).length > 0 && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                {(previewLang === 'ko' ? greetingImagesKO : greetingImagesEN).map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-auto rounded-lg shadow-md"
                  />
                ))}
              </div>
            )}

            {/* HTML Content */}
            <div
              className="prose prose-slate max-w-none text-slate-700"
              dangerouslySetInnerHTML={{
                __html: previewLang === 'ko'
                  ? presidentGreetingKO || presidentGreetingEN
                  : presidentGreetingEN || presidentGreetingKO
              }}
            />

            {!(previewLang === 'ko' ? presidentGreetingKO : presidentGreetingEN) &&
              !(previewLang === 'ko' ? greetingImagesKO : greetingImagesEN).length && (
                <p className="text-slate-400 text-center py-8">
                  {previewLang === 'ko' ? '내용을 입력해주세요' : 'Please enter content'}
                </p>
              )}
          </div>
        </div>
      </section>

      {/* Society Introduction Section */}
      <section className="bg-white rounded-2xl border border-[#c3daee] p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">학회 소개</h2>

        <div className="space-y-6">
          {/* Korean */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              한국어
            </label>
            <RichTextEditor
              value={introKO}
              onChange={setIntroKO}
              placeholder="학회 소개 내용을 입력하세요..."
            />
          </div>

          {/* English */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              English
            </label>
            <RichTextEditor
              value={introEN}
              onChange={setIntroEN}
              placeholder="Enter society introduction..."
            />
          </div>

          {/* Preview */}
          <div className="bg-[#f0f5fa] rounded-xl p-6 border border-[#c3daee]">
            <h3 className="text-sm font-bold text-slate-600 mb-3">미리보기 / Preview</h3>
            <div
              className="prose prose-slate max-w-none text-slate-700"
              dangerouslySetInnerHTML={{
                __html: previewLang === 'ko' ? introKO : introEN || introKO
              }}
            />
            {!(previewLang === 'ko' ? introKO : introEN) && (
              <p className="text-slate-400 text-center py-8">
                {previewLang === 'ko' ? '내용을 입력해주세요' : 'Please enter content'}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Notices Section */}
      <section className="bg-white rounded-2xl border border-[#c3daee] p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">공지사항 관리</h2>

        {/* Add New Notice Form */}
        <div className="bg-[#f0f5fa] rounded-xl p-6 mb-6 border border-[#c3daee]">
          <h3 className="text-base font-semibold text-gray-800 mb-4">새 공지사항 추가</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
              <select
                value={newNotice.category}
                onChange={(e) => setNewNotice({ ...newNotice, category: e.target.value as '공지' | '뉴스' | '안내' })}
                className="w-full p-3 border border-[#c3daee] rounded-xl focus:ring-2 focus:ring-[#003366]"
              >
                <option value="공지">공지 / Notice</option>
                <option value="뉴스">뉴스 / News</option>
                <option value="안내">안내 / Info</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  제목 (한국어)
                </label>
                <input
                  type="text"
                  value={newNotice.titleKO}
                  onChange={(e) => setNewNotice({ ...newNotice, titleKO: e.target.value })}
                  className="w-full p-3 border border-[#c3daee] rounded-xl focus:ring-2 focus:ring-[#003366]"
                  placeholder="공지 제목"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title (English)
                </label>
                <input
                  type="text"
                  value={newNotice.titleEN}
                  onChange={(e) => setNewNotice({ ...newNotice, titleEN: e.target.value })}
                  className="w-full p-3 border border-[#c3daee] rounded-xl focus:ring-2 focus:ring-[#003366]"
                  placeholder="Notice title"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  내용 (한국어)
                </label>
                <textarea
                  value={newNotice.contentKO}
                  onChange={(e) => setNewNotice({ ...newNotice, contentKO: e.target.value })}
                  rows={4}
                  className="w-full p-3 border border-[#c3daee] rounded-xl focus:ring-2 focus:ring-[#003366] resize-none"
                  placeholder="공지 내용"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content (English)
                </label>
                <textarea
                  value={newNotice.contentEN}
                  onChange={(e) => setNewNotice({ ...newNotice, contentEN: e.target.value })}
                  rows={4}
                  className="w-full p-3 border border-[#c3daee] rounded-xl focus:ring-2 focus:ring-[#003366] resize-none"
                  placeholder="Notice content"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddNotice}
              className="flex items-center justify-center gap-2 w-full md:w-auto px-6 py-2 bg-[#003366] text-white rounded-xl font-medium hover:bg-[#002244] transition-colors"
            >
              <Plus size={16} />
              추가
            </button>
          </div>
        </div>

        {/* Existing Notices List */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-gray-800">
            등록된 공지사항 ({notices.length})
          </h3>

          {notices.length === 0 ? (
            <div className="text-center py-12 bg-[#f0f5fa] rounded-xl border-2 border-dashed border-[#c3daee]">
              <p className="text-slate-400 font-medium">
                {previewLang === 'ko' ? '등록된 공지사항이 없습니다' : 'No notices yet'}
              </p>
            </div>
          ) : (
            notices.map((notice) => (
              <div
                key={notice.id}
                className="bg-white border border-[#c3daee] rounded-xl p-6 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold">
                        {notice.category}
                      </span>
                      <span className="text-slate-400 text-sm">
                        {safeFormatDate(notice.date, 'ko-KR')}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-slate-900 mb-2">
                      {previewLang === 'ko' ? notice.title?.ko : notice.title?.en || notice.title?.ko}
                    </h4>
                    <p className="text-slate-600 text-sm whitespace-pre-line">
                      {previewLang === 'ko'
                        ? notice.content?.ko
                        : notice.content?.en || notice.content?.ko}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteNotice(notice.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default SocietyContentManagementPage;

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
        <div className="text-slate-400">로딩 중 / Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900">
            학회 콘텐츠 관리 / Society Content Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            학회장 인사말, 공지사항 등을 관리합니다 / Manage president greeting and notices
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={20} />
          {saving ? '저장 중 / Saving...' : '저장 / Save'}
        </button>
      </div>

      {/* Preview Language Toggle */}
      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
        <Languages size={20} className="text-slate-400" />
        <span className="text-sm font-bold text-slate-600">미리보기 언어 / Preview Language:</span>
        <button
          type="button"
          onClick={() => setPreviewLang('ko')}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition ${previewLang === 'ko'
            ? 'bg-blue-600 text-white'
            : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
        >
          한국어 / KO
        </button>
        <button
          type="button"
          onClick={() => setPreviewLang('en')}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition ${previewLang === 'en'
            ? 'bg-blue-600 text-white'
            : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
        >
          English / EN
        </button>
      </div>

      {/* President Greeting Section */}
      <section className="bg-white rounded-2xl border border-slate-200 p-8">
        <h2 className="text-2xl font-black text-slate-900 mb-6">학회장 인사말 / President's Greeting</h2>

        <div className="space-y-8">
          {/* Korean */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              🇰🇷 한국어 / Korean
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
              <label className="block text-sm font-bold text-slate-700 mb-2">
                이미지 추가 / Add Images
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition">
                  <ImageIcon size={18} />
                  <span className="text-sm font-bold text-slate-700">
                    {uploadingImage ? '업로드 중 / Uploading...' : '이미지 선택 / Choose Image'}
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
            <label className="block text-sm font-bold text-slate-700 mb-2">
              🇺🇸 English
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
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Images for English / 영어용 이미지
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition">
                  <ImageIcon size={18} />
                  <span className="text-sm font-bold text-slate-700">
                    {uploadingImage ? 'Uploading...' : 'Choose Image'}
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
          <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-6 border border-slate-200">
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
      <section className="bg-white rounded-2xl border border-slate-200 p-8">
        <h2 className="text-2xl font-black text-slate-900 mb-6">학회 소개 / Society Introduction</h2>

        <div className="space-y-8">
          {/* Korean */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              🇰🇷 한국어 / Korean
            </label>
            <RichTextEditor
              value={introKO}
              onChange={setIntroKO}
              placeholder="학회 소개 내용을 입력하세요..."
            />
          </div>

          {/* English */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              🇺🇸 English
            </label>
            <RichTextEditor
              value={introEN}
              onChange={setIntroEN}
              placeholder="Enter society introduction..."
            />
          </div>

          {/* Preview */}
          <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-6 border border-slate-200">
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
      <section className="bg-white rounded-2xl border border-slate-200 p-8">
        <h2 className="text-2xl font-black text-slate-900 mb-6">공지사항 관리 / Notice Management</h2>

        {/* Add New Notice Form */}
        <div className="bg-slate-50 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-bold text-slate-900 mb-4">새 공지사항 추가 / Add New Notice</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">카테고리 / Category</label>
              <select
                value={newNotice.category}
                onChange={(e) => setNewNotice({ ...newNotice, category: e.target.value as '공지' | '뉴스' | '안내' })}
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                <option value="공지">공지 / Notice</option>
                <option value="뉴스">뉴스 / News</option>
                <option value="안내">안내 / Info</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  제목 (한국어) / Title (KO)
                </label>
                <input
                  type="text"
                  value={newNotice.titleKO}
                  onChange={(e) => setNewNotice({ ...newNotice, titleKO: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="공지 제목"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Title (English)
                </label>
                <input
                  type="text"
                  value={newNotice.titleEN}
                  onChange={(e) => setNewNotice({ ...newNotice, titleEN: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="Notice title"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  내용 (한국어) / Content (KO)
                </label>
                <textarea
                  value={newNotice.contentKO}
                  onChange={(e) => setNewNotice({ ...newNotice, contentKO: e.target.value })}
                  rows={4}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="공지 내용"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Content (English)
                </label>
                <textarea
                  value={newNotice.contentEN}
                  onChange={(e) => setNewNotice({ ...newNotice, contentEN: e.target.value })}
                  rows={4}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Notice content"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddNotice}
              className="flex items-center justify-center gap-2 w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition"
            >
              <Plus size={20} />
              추가 / Add Notice
            </button>
          </div>
        </div>

        {/* Existing Notices List */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900">
            등록된 공지사항 / Existing Notices ({notices.length})
          </h3>

          {notices.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400 font-bold">
                {previewLang === 'ko' ? '등록된 공지사항이 없습니다' : 'No notices yet'}
              </p>
            </div>
          ) : (
            notices.map((notice) => (
              <div
                key={notice.id}
                className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-all"
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

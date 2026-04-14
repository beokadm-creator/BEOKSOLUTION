import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ConsentHistoryEntry } from '../types';

interface ProfileTabProps {
    loading: boolean;
    profile: {
        displayName: string;
        phoneNumber: string;
        affiliation: string;
        licenseNumber: string;
        email: string;
    };
    profileSaving: boolean;
    guestbookEntries: ConsentHistoryEntry[];
    handleProfileFieldChange: (field: 'displayName' | 'phoneNumber' | 'affiliation' | 'licenseNumber', value: string) => void;
    handleSaveProfile: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
    loading,
    profile,
    profileSaving,
    guestbookEntries,
    handleProfileFieldChange,
    handleSaveProfile
}) => {
    return (
        <div className="bg-white/95 p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-lg mb-6">내 정보 확인</h3>
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i}>
                            <Skeleton className="h-4 w-20 mb-1" />
                            <Skeleton className="h-12 w-full rounded-lg" />
                        </div>
                    ))}
                </div>
            ) : (
                <>
                    <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded">기본 정보는 여기에서 바로 수정할 수 있습니다.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">이름</label><input type="text" className="w-full border p-3 rounded-lg bg-white" value={profile.displayName} onChange={(e) => handleProfileFieldChange('displayName', e.target.value)} /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label><input type="text" className="w-full border p-3 rounded-lg bg-white" value={profile.phoneNumber} onChange={(e) => handleProfileFieldChange('phoneNumber', e.target.value)} /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">소속</label><input type="text" className="w-full border p-3 rounded-lg bg-white" value={profile.affiliation} onChange={(e) => handleProfileFieldChange('affiliation', e.target.value)} /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">면허번호</label><input type="text" className="w-full border p-3 rounded-lg bg-white" value={profile.licenseNumber} onChange={(e) => handleProfileFieldChange('licenseNumber', e.target.value)} /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">이메일</label><input type="text" className="w-full border p-3 rounded-lg bg-gray-100" value={profile.email} disabled /></div>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleSaveProfile}
                            disabled={profileSaving}
                            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            {profileSaving ? '저장 중...' : '기본 정보 저장'}
                        </button>
                    </div>
                    <div className="mt-8 border-t border-gray-100 pt-6">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-bold text-gray-900">내 정보 제공 이력</h4>
                            <span className="text-xs font-semibold text-gray-500">{guestbookEntries.length}건</span>
                        </div>
                        {guestbookEntries.length === 0 ? (
                            <div className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-4">
                                아직 제3자 정보 제공 이력이 없습니다.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {guestbookEntries.map((entry) => (
                                    <div key={entry.id} className="flex flex-col gap-1 border border-gray-100 rounded-lg p-4">
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                            <span className="font-semibold text-gray-700">{entry.conferenceName}</span>
                                            <span className="text-gray-300">•</span>
                                            <span>{entry.vendorName}</span>
                                            {entry.timestamp?.toDate && (
                                                <>
                                                    <span className="text-gray-300">•</span>
                                                    <span>{entry.timestamp.toDate().toLocaleString()}</span>
                                                </>
                                            )}
                                        </div>
                                        <div className="text-sm text-emerald-700 font-semibold">동의 완료</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAdminStore } from '../../store/adminStore';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

const ConferenceSelector: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const { 
        selectedConferenceId, 
        availableConferences, 
        selectConference, 
        setAvailableConferences,
        autoSelectIfOnlyOne 
    } = useAdminStore();

    useEffect(() => {
        const fetchConferences = async () => {
            try {
                // Get society ID from current subdomain
                const hostname = window.location.hostname;
                const parts = hostname.split('.');
                const societyId = parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin' ? parts[0] : null;
                
                if (!societyId) {
                    setError("Cannot determine society ID from domain");
                    return;
                }

                console.log(`[ConferenceSelector] Fetching conferences for society: ${societyId}`);
                
                // Query all conferences for this society
                const conferencesRef = collection(db, 'conferences');
                const q = query(conferencesRef, where('societyId', '==', societyId));
                const querySnapshot = await getDocs(q);
                
                const conferences = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    societyId: doc.data().societyId,
                    slug: doc.data().slug,
                    title: doc.data().title,
                    dates: doc.data().dates,
                    status: doc.data().status,
                }));

                console.log(`[ConferenceSelector] Found ${conferences.length} conferences`, conferences);
                
                setAvailableConferences(conferences);
                autoSelectIfOnlyOne();
                
            } catch (err) {
                console.error('[ConferenceSelector] Error:', err);
                setError('Failed to load conferences');
            } finally {
                setLoading(false);
            }
        };

        fetchConferences();
    }, [setAvailableConferences, autoSelectIfOnlyOne]);

    const handleConferenceChange = (conferenceId: string) => {
        const conference = availableConferences.find(c => c.id === conferenceId);
        if (conference) {
            console.log(`[ConferenceSelector] Selected conference:`, conference);
            selectConference(conference.id, conference.slug, conference.societyId);
        }
    };

    if (loading) {
        return (
            <div className="px-4 pb-4">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-slate-400">로딩 중...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="px-4 pb-4">
                <p className="text-red-400 text-sm">{error}</p>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.location.reload()}
                    className="mt-2 border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                >
                    새로고침
                </Button>
            </div>
        );
    }

    if (availableConferences.length === 0) {
        return (
            <div className="px-4 pb-4">
                <p className="text-yellow-400 text-sm">
                    이 학회에 등록된 컨퍼런스가 없습니다.
                </p>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                        // TODO: Navigate to conference creation
                        toast('컨퍼런스 생성 기능은 준비 중입니다.');
                    }}
                    className="mt-2 border-yellow-600 text-yellow-400 hover:bg-yellow-600 hover:text-white"
                >
                    컨퍼런스 생성
                </Button>
            </div>
        );
    }

    const selectedConference = availableConferences.find(c => c.id === selectedConferenceId);

    return (
        <div className="px-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="font-medium text-sm text-slate-300">컨퍼런스 선택</span>
            </div>
            
            <select 
                className="w-full h-10 rounded-md border border-slate-600 bg-slate-800 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={selectedConferenceId || ''} 
                onChange={(e) => handleConferenceChange(e.target.value)}
            >
                <option value="" className="text-slate-800">
                    관리할 컨퍼런스를 선택하세요
                </option>
                {availableConferences.map((conference) => (
                    <option key={conference.id} value={conference.id} className="text-slate-800">
                        {conference.title.ko} ({conference.slug})
                    </option>
                ))}
            </select>
            
            {selectedConference && (
                <div className="mt-3 p-2 bg-blue-600 rounded-md">
                    <p className="text-xs text-blue-100">
                        <strong>선택된 컨퍼런스:</strong> {selectedConference.title.ko}
                        {selectedConference.title.en && ` / ${selectedConference.title.en}`}
                    </p>
                </div>
            )}
        </div>
    );
};

export default ConferenceSelector;
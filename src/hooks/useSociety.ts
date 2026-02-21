import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Society } from '../types/schema';

export const useSociety = () => {
    const [society, setSociety] = useState<Society | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSociety = async () => {
            const host = window.location.hostname;
            const parts = host.split('.');
            let societyId = null;

            // ✅ 0순위: URL 파라미터 ?society=kadd (DEV 환경)
            const params = new URLSearchParams(window.location.search);
            const societyParam = params.get('society');
            if (societyParam) {
                societyId = societyParam;
            }
            // ✅ 1순위: sessionStorage에서 가져오기 (로그인 후 리다이렉트 시)
            else if (sessionStorage.getItem('societyId')) {
                societyId = sessionStorage.getItem('societyId');
            }
            // ✅ 2순위: 서브도메인 (kadd.eregi.co.kr)
            else if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') {
                societyId = parts[0];
            }
            // ✅ 3순위: kadd로 시작하는 도메인
            else if (host.startsWith('kadd.')) {
                societyId = 'kadd';
            }

            if (!societyId) {
                setLoading(false);
                return;
            }

            try {
                const docRef = doc(db, 'societies', societyId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSociety({ id: docSnap.id, ...docSnap.data() } as Society);
                } else {
                    console.error(`[useSociety] Society document not found: ${societyId}`);
                    setError('Society not found');
                }
            } catch (err: unknown) {
                console.error(`[useSociety] Error fetching society:`, err);
                const message = err instanceof Error ? err.message : 'Unknown error';
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        fetchSociety();
    }, []);

    return { society, loading, error };
};

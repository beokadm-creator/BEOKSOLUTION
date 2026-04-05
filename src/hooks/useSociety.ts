import { useState, useEffect } from 'react';
import { Society } from '../types/schema';
import { extractSocietyFromHost } from '../utils/domainHelper';
import { resolveSocietyByIdentifier } from '../utils/societyResolver';

export const useSociety = () => {
    const [society, setSociety] = useState<Society | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSociety = async () => {
            const host = window.location.hostname;
            let societyId = null;

            // ✅ 0순위: URL 파라미터 ?society=xxx (DEV 환경)
            const params = new URLSearchParams(window.location.search);
            const societyParam = params.get('society');
            if (societyParam) {
                societyId = societyParam;
            }
            // ✅ 1순위: sessionStorage에서 가져오기 (로그인 후 리다이렉트 시)
            else if (sessionStorage.getItem('societyId')) {
                societyId = sessionStorage.getItem('societyId');
            }
            // ✅ 2순위: 서브도메인 (helper 함수 활용)
            else {
                const extracted = extractSocietyFromHost(host);
                if (extracted) {
                    societyId = extracted;
                }
                // ✅ 3순위: Admin URL Path에서 추출 (/admin/conf/:cid)
                else if (window.location.pathname.startsWith('/admin/conf/')) {
                    const pathParts = window.location.pathname.split('/');
                    if (pathParts.length > 3) {
                        const cid = pathParts[3];
                        if (cid.includes('_')) {
                            societyId = cid.split('_')[0];
                        }
                    }
                }
            }

            if (!societyId) {
                setLoading(false);
                return;
            }

            try {
                const resolved = await resolveSocietyByIdentifier(societyId);
                if (resolved) {
                    setSociety({ id: resolved.id, ...resolved.data } as Society);
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

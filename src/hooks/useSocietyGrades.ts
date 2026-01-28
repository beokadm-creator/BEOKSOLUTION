import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';
import { db } from '../firebase';

export interface GradeMasterData {
    code: string;
    name: {
        ko: string;
        en: string;
    };
}

export const useSocietyGrades = (societyId: string | undefined) => {
    const [searchParams] = useSearchParams();
    const mode = searchParams.get('mode');
    
    // Technical Compliance: Support guest mode fallback to 'kadd'
    const effectiveSocietyId = societyId || 'kadd';

    const [gradeMasterMap, setGradeMasterMap] = useState<Map<string, { ko: string; en: string }>>(new Map());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!effectiveSocietyId) {
            setGradeMasterMap(new Map());
            return;
        }

        setLoading(true);
        // Changed from doc() to collection() based on new requirements
        // Path: societies/{societyId}/settings/grades/list (Collection)
        const colRef = collection(db, 'societies', effectiveSocietyId, 'settings', 'grades', 'list');

        const unsubscribe = onSnapshot(colRef, (snapshot) => {
            try {
                const map = new Map<string, { ko: string; en: string }>();

                if (!snapshot.empty) {
                    snapshot.docs.forEach((doc) => {
                        const data = doc.data();
                        // Use doc.id as fallback code if 'code' field is missing, or vice-versa
                        // Requirement: use doc.id (e.g. member) or internal code
                        const code = data.code || doc.id;
                        
                        if (code) {
                            const nameObj = typeof data.name === 'object' ? data.name : { ko: data.name, en: data.name };
                            map.set(code, nameObj);
                        }
                    });
                } else {
                    console.warn("Society Grade Master is Empty! (No docs in 'list' collection)");
                }

                setGradeMasterMap(map);
            } catch (err: any) {
                console.error("[useSocietyGrades] Error parsing data:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }, (err) => {
            console.error("[useSocietyGrades] Snapshot error:", err);
            setError(err.message);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [effectiveSocietyId]);

    const getGradeLabel = (code: string, lang: 'ko' | 'en' = 'ko') => {
        // 1. Try to find by code in the map
        if (code && gradeMasterMap.has(code)) {
            const entry = gradeMasterMap.get(code);
            return entry?.[lang] || entry?.['ko'] || code;
        }
        
        return code;
    };

    // Task 3: Data Caching (Memoize return value)
    return useMemo(() => ({ 
        gradeMasterMap, 
        loading, 
        error, 
        getGradeLabel 
    }), [gradeMasterMap, loading, error]);
};

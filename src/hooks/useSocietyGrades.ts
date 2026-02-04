import { useState, useEffect, useMemo, useCallback } from 'react';
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
    useSearchParams();

    // Technical Compliance: Support guest mode fallback to 'kadd'
    const effectiveSocietyId = societyId || 'kadd';

    const [gradeMasterMap, setGradeMasterMap] = useState<Map<string, { ko: string; en: string }>>(new Map());
    const [gradesList, setGradesList] = useState<GradeMasterData[]>([]);
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
                const list: GradeMasterData[] = [];

                if (!snapshot.empty) {
                    snapshot.docs.forEach((doc) => {
                        const data = doc.data();
                        const nameObj = typeof data.name === 'object' ? data.name : { ko: data.name, en: data.name };

                        // PRIMARY KEY: Use code field only (eliminates duplicate keys from doc.id)
                        if (data.code) {
                            map.set(data.code, nameObj);
                            list.push({
                                code: data.code,
                                name: nameObj
                            });
                        } else {
                            // Fallback for legacy grades without code field
                            console.warn(`[useSocietyGrades] Grade at ${doc.ref.path} missing 'code' field, using doc.id as fallback`);
                            map.set(doc.id, nameObj);
                            list.push({
                                code: doc.id,
                                name: nameObj
                            });
                        }
                    });

                    // Debug: Log loaded grade map
                    console.log('[useSocietyGrades] Grade master data loaded:', {
                        societyId: effectiveSocietyId,
                        totalGrades: map.size,
                        availableCodes: Array.from(map.keys()),
                        allEntries: Array.from(map.entries())
                    });
                } else {
                    console.warn("[useSocietyGrades] Society Grade Master is Empty! (No docs in 'list' collection)");
                }

                setGradeMasterMap(map);
                setGradesList(list);
            } catch (err: unknown) {
                console.error("[useSocietyGrades] Error parsing data:", err);
                setError(err instanceof Error ? err.message : String(err));
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

    const getGradeLabel = useCallback((code: string, lang: 'ko' | 'en' = 'ko') => {
        if (!code) {
            console.warn('[useSocietyGrades] getGradeLabel called with empty code');
            return lang === 'ko' ? '알 수 없음' : 'Unknown';
        }

        // 0. Handle System/Reserved Grades
        if (code === '평생회원' || code === 'LIFETIME') {
            return lang === 'ko' ? '평생회원' : 'Lifetime Member';
        }

        // Debug: Log the code being looked up
        console.log('[useSocietyGrades] getGradeLabel called with:', {
            code,
            codeType: typeof code,
            availableCodes: Array.from(gradeMasterMap.keys()),
            requestedLang: lang
        });

        // 1. Try exact match (case-sensitive)
        if (gradeMasterMap.has(code)) {
            const entry = gradeMasterMap.get(code);
            console.log('[useSocietyGrades] Exact match found:', entry);
            return entry?.[lang] || entry?.['ko'] || code;
        }

        // 2. Try case-insensitive match
        const lowerCode = code.toLowerCase();
        for (const [key, value] of gradeMasterMap.entries()) {
            if (key.toLowerCase() === lowerCode) {
                console.log('[useSocietyGrades] Case-insensitive match found:', value);
                return value[lang] || value['ko'] || code;
            }
        }

        // 3. Try trimming and case-insensitive match (handle trailing/leading spaces)
        const trimmedCode = code.trim().toLowerCase();
        for (const [key, value] of gradeMasterMap.entries()) {
            if (key.trim().toLowerCase() === trimmedCode) {
                console.log('[useSocietyGrades] Trimmed match found:', value);
                return value[lang] || value['ko'] || code;
            }
        }

        // 4. Try matching against name fields (if code doesn't match but name does)
        for (const [, value] of gradeMasterMap.entries()) {
            if (value.ko.toLowerCase().includes(lowerCode) ||
                value.en.toLowerCase().includes(lowerCode)) {
                console.log('[useSocietyGrades] Name match found:', value);
                return value[lang] || value['ko'] || code;
            }
        }

        // 5. Fallback: Return original code with warning
        console.warn('[useSocietyGrades] No match found for code:', code, 'Available codes:', Array.from(gradeMasterMap.keys()));
        return code;
    }, [gradeMasterMap]);

    // Task 3: Data Caching (Memoize return value)
    const result = useMemo(() => {
        // Define reverse lookup inside useMemo to capture latest gradeMasterMap
        const reverseLookup = (name: string): string | null => {
            if (!name) return null;

            const normalizedName = name.toLowerCase().replace(/\s/g, '');

            for (const [code, labelObj] of gradeMasterMap.entries()) {
                const koName = labelObj.ko.toLowerCase().replace(/\s/g, '');
                const enName = labelObj.en.toLowerCase().replace(/\s/g, '');

                if (koName === normalizedName || enName === normalizedName ||
                    koName.includes(normalizedName) || enName.includes(normalizedName)) {
                    console.log('[useSocietyGrades] getGradeCodeByName found:', code, 'for name:', name);
                    return code;
                }
            }

            console.warn('[useSocietyGrades] getGradeCodeByName: No match found for name:', name);
            return null;
        };

        return {
            gradeMasterMap,
            gradesList,
            loading,
            error,
            getGradeLabel,
            getGradeCodeByName: reverseLookup
        };
    }, [gradeMasterMap, gradesList, loading, error, getGradeLabel]);

    return result;
};

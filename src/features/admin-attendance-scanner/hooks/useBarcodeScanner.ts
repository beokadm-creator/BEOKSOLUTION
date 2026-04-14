import { useState, useRef, useEffect } from 'react';
import { ScannerState, ScannerMode, Zone } from '../types';
import { useAttendanceTransaction } from './useAttendanceTransaction';

export function useBarcodeScanner(cid: string | undefined, selectedZoneId: string, mode: ScannerMode, zones: Zone[]) {
    const [scannerState, setScannerState] = useState<ScannerState>({
        status: 'IDLE',
        message: 'Ready to Scan',
        lastScanned: ''
    });
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');
    const scanMemoryRef = useRef<Map<string, number>>(new Map());

    const { runAttendanceTransaction } = useAttendanceTransaction(cid, zones);

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 500);
    }, []);

    const handleBlur = () => setTimeout(() => inputRef.current?.focus(), 100);

    const processScan = async (code: string) => {
        if (scannerState.status === 'PROCESSING') return;
        setInputValue('');

        const nowMs = Date.now();
        const lastScanMs = scanMemoryRef.current.get(code);
        if (lastScanMs && nowMs - lastScanMs < 10000) {
            setScannerState({ status: 'ERROR', message: '너무 빠릅니다. (10초 대기)', lastScanned: code });
            setTimeout(() => setScannerState(prev => prev.status === 'PROCESSING' ? prev : { ...prev, status: 'IDLE' }), 1000);
            return;
        }

        if (!selectedZoneId || !cid) { setScannerState({ status: 'ERROR', message: '설정 미완료', lastScanned: code }); return; }

        setScannerState({ status: 'PROCESSING', message: '확인 중...', lastScanned: code });

        try {
            const decodeTypos = (s: string) => {
                const map: any = { 'ㅂ': 'q', 'ㅈ': 'w', 'ㄷ': 'e', 'ㄱ': 'r', 'ㅅ': 't', 'ㅛ': 'y', 'ㅕ': 'u', 'ㅑ': 'i', 'ㅐ': 'o', 'ㅔ': 'p', 'ㅁ': 'a', 'ㄴ': 's', 'ㅇ': 'd', 'ㄹ': 'f', 'ㅎ': 'g', 'ㅗ': 'h', 'ㅓ': 'j', 'ㅏ': 'k', 'ㅣ': 'l', 'ㅋ': 'z', 'ㅌ': 'x', 'ㅊ': 'c', 'ㅍ': 'v', 'ㅠ': 'b', 'ㅜ': 'n', 'ㅡ': 'm' };
                return s.split('').map(c => map[c] || c).join('').replace(/[^a-zA-Z0-9-]/g, '');
            };

            const raw = decodeTypos(code).trim();
            let id = raw;
            if (raw.toUpperCase().startsWith('BADGE-')) id = raw.substring(6);

            const isExt = id.startsWith('EXT-');
            const res = await runAttendanceTransaction(id, selectedZoneId, isExt, mode);

            scanMemoryRef.current.set(code, Date.now());
            setScannerState({
                status: 'SUCCESS',
                message: res.actionText,
                subMessage: res.userName,
                lastScanned: id,
                userData: { name: res.userName, affiliation: res.affiliation },
                actionType: res.actionType
            });
        } catch (e: any) {
            console.error(e);
            setScannerState({ status: 'ERROR', message: e.message || 'Error', lastScanned: code });
        } finally {
            setTimeout(() => setScannerState(prev => prev.status === 'PROCESSING' ? prev : { ...prev, status: 'IDLE' }), 1200);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && inputValue.trim()) processScan(inputValue.trim()); };

    return {
        scannerState,
        inputRef,
        inputValue,
        setInputValue,
        handleKeyDown,
        handleBlur
    };
}

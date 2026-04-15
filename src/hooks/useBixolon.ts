import { useState } from 'react';
import { BadgeElement } from '../types/schema';

// Bixolon Web Print SDK configuration
const SDK_BASE_URL = `http://127.0.0.1:18080/WebPrintSDK`;
const PRINTER_NAME = 'Printer1';

// Renewal: 무조건 mm를 받아서 dots로 변환 (추론/px 로직 전면 폐기)
const mmToDots = (mm: number, dpmm: number) => Math.round(mm * dpmm);

export const useBixolon = () => {
    const [printing, setPrinting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * 텍스트의 추정 너비를 dots 단위로 계산 (Malgun Gothic Bold 기준)
     */
    const estimateTextWidthDots = (text: string, fontDots: number): number => {
        let w = 0;
        for (const ch of text) {
            const code = ch.charCodeAt(0);
            if (code >= 0xAC00 && code <= 0xD7A3) w += fontDots * 1.15; // 한글
            else if (code >= 0x4E00 && code <= 0x9FFF) w += fontDots * 1.15; // 한자
            else if (code >= 0xFF00 && code <= 0xFFEF) w += fontDots * 1.15; // 전각 문자
            else w += fontDots * 0.65; // 영문/숫자
        }
        return Math.round(w);
    };

    const buildPrintData = (
        layout: {
            width: number;
            height: number;
            elements: BadgeElement[];
            enableCutting?: boolean;
            printerDpmm?: number;
            printOffsetXmm?: number;
            printOffsetYmm?: number;
            printStartOffsetMm?: number;
            mediaType?: number;
            marginXMm?: number;
            marginYMm?: number;
            cutPaperType?: 0 | 1;
        },
        userData: {
            name: string; org: string; category?: string;
            license?: string; price?: string; affiliation?: string; qrData: string;
        }
    ) => {
        const dpmm = layout.printerDpmm || 8; // 203 DPI = 8 dpmm
        
        // Offset (mm -> dots)
        const offsetXdots = mmToDots(layout.printOffsetXmm || 0, dpmm);
        const offsetYdots = mmToDots(layout.printOffsetYmm || 0, dpmm);

        // Hardware Margin (mm -> dots)
        const marginXDots = mmToDots(layout.marginXMm || 0, dpmm);
        const marginYDots = mmToDots(layout.marginYMm || 0, dpmm);
        
        // Media Type (0: Gap, 1: Continuous, 2: Black Mark)
        const mediaType = layout.mediaType || 0;
        const setLengthOffsetDots = mediaType === 1 ? 0 : mmToDots(layout.printStartOffsetMm || 0, dpmm);

        // Paper Size (mm -> dots)
        // 만약 기존 px 데이터(width > 250)가 넘어오면 강제로 mm 비율(100x240)로 클램핑하여 오작동 방지
        const safeWidthMm = layout.width > 250 ? 100 : layout.width;
        const safeHeightMm = layout.height > 350 ? 240 : layout.height;
        
        const widthDots = mmToDots(safeWidthMm, dpmm);
        const heightDots = mmToDots(safeHeightMm, dpmm);

        const functions: Record<string, any> = {
            "func01": { "clearBuffer": [] },
            "func02": { "setMargin": [marginXDots, marginYDots] },
            "func03": { "setReferencePoint": [0, 0] },
            "func04": { "setDirection": [0] },
            "func05": { "setWidth": [widthDots] },
            "func06": { "setLength": [heightDots, mediaType === 1 ? 0 : 24, mediaType, setLengthOffsetDots] }
        };

        let fIdx = 7;
        const cutType = layout.cutPaperType ?? 0;
        const cutterEnabled = layout.enableCutting !== false ? 1 : 0;
        functions[`func${String(fIdx++).padStart(2, '0')}`] = { "setAutoCutter": [cutterEnabled, cutType] };
        for (const el of layout.elements) {
            if (!el.isVisible) continue;

            // X, Y (mm -> dots)
            // 레거시 px 데이터가 섞여 들어오는 것을 방지하기 위해 x가 200 이상이면 비정상으로 간주하고 mm로 보정
            const safeXMm = el.x > 250 ? el.x / 3.78 : el.x;
            const safeYMm = el.y > 350 ? el.y / 3.78 : el.y;
            const safeFontSizeMm = el.fontSize > 100 && el.type !== 'IMAGE' ? el.fontSize / 3.78 : el.fontSize;

            const baseXDots = mmToDots(safeXMm, dpmm);
            const baseYDots = mmToDots(safeYMm, dpmm) + offsetYdots;

            const content = el.type === 'CUSTOM'
                ? (el.content || '')
                : (userData[el.type.toLowerCase() as keyof typeof userData] || '');

            if (el.type === 'QR') {
                const qrSizeDots = mmToDots(safeFontSizeMm || 25, dpmm);
                const qrMag = Math.max(1, Math.min(10, Math.round(qrSizeDots / 28))); // 빅솔론 QR 배율 (1~10)
                functions[`func${String(fIdx++).padStart(2, '0')}`] = {
                    "drawQRCode": [
                        userData.qrData || 'NO_DATA', baseXDots + offsetXdots, baseYDots, 1, "M", qrMag, 0
                    ]
                };
            } else if (el.type === 'IMAGE') {
                functions[`func${String(fIdx++).padStart(2, '0')}`] = {
                    "drawBitmap": [
                        content, baseXDots + offsetXdots, baseYDots, mmToDots(safeFontSizeMm || 50, dpmm), 0
                    ]
                };
            } else {
                if (!content) continue;

                const fontDots = mmToDots(safeFontSizeMm || 6, dpmm);
                let lines = [content];
                const lineSpacingDots = fontDots * 0.35; // 줄간격

                // 최대 너비(maxWidth) 지정 시 자동 줄바꿈
                const safeMaxWidthMm = el.maxWidth ? (el.maxWidth > 250 ? el.maxWidth / 3.78 : el.maxWidth) : undefined;
                
                if (safeMaxWidthMm) {
                    const maxDots = mmToDots(safeMaxWidthMm, dpmm);
                    const estWidth = estimateTextWidthDots(content, fontDots);

                    if (estWidth > maxDots) {
                        lines = [];
                        let currentLine = '';
                        for (let i = 0; i < content.length; i++) {
                            const tempWidth = estimateTextWidthDots(currentLine + content[i], fontDots);
                            if (tempWidth > maxDots && currentLine.length > 0) {
                                lines.push(currentLine.trim());
                                currentLine = content[i];
                            } else {
                                currentLine += content[i];
                            }
                        }
                        if (currentLine) lines.push(currentLine.trim());
                    }
                }

                // 라인별 출력
                lines.forEach((lineText, lineIdx) => {
                    const currentLineYDots = baseYDots + (lineIdx * (fontDots + lineSpacingDots));
                    let printXDots = baseXDots + offsetXdots;

                    // 가운데 정렬 (Renewal: 무조건 x 좌표 무시가 아니라, 지정된 영역이 있으면 그 안에서 중앙 정렬)
                    if (el.textAlign === 'center') {
                        const lineWidthDots = estimateTextWidthDots(lineText, fontDots);
                        if (safeMaxWidthMm) {
                            const boxWidthDots = mmToDots(safeMaxWidthMm, dpmm);
                            const boxLeftDots = baseXDots + offsetXdots;
                            printXDots = Math.round(boxLeftDots + ((boxWidthDots - lineWidthDots) / 2));
                        } else {
                            printXDots = Math.round(((widthDots - lineWidthDots) / 2) + offsetXdots);
                        }
                    }

                    // 프린터 밖으로 나가지 않도록 최소 0 이상 유지
                    printXDots = Math.max(printXDots, 0);

                    functions[`func${String(fIdx++).padStart(2, '0')}`] = {
                        "drawTrueTypeFont": [
                            lineText, printXDots, Math.round(currentLineYDots),
                            "Malgun Gothic", fontDots,
                            0, false, true, false, false
                        ]
                    };
                });
            }
        }

        functions[`func${String(fIdx++).padStart(2, '0')}`] = { "printBuffer": [] };

        return { "id": Math.floor(Math.random() * 1000) + 1, "functions": functions };
    };

    const printViaHttp = async (payload: object): Promise<boolean> => {
        const printUrl = `${SDK_BASE_URL}/${PRINTER_NAME}`;
        try {
            const response = await fetch(printUrl, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify(payload)
            });
            const text = await response.text();
            if (!response.ok) {
                setError(text || `${response.status} ${response.statusText}`);
                return false;
            }
            if (text) {
                try {
                    const data = JSON.parse(text) as Record<string, unknown>;
                    const resultCode = String(
                        (data.ResultCode ?? data.resultCode ?? data.result ?? data.code ?? '')
                    ).toLowerCase();
                    if (
                        resultCode &&
                        resultCode !== 'success' &&
                        resultCode !== '0' &&
                        resultCode !== 'ok'
                    ) {
                        setError(text);
                        return false;
                    }
                } catch {
                    void 0;
                }
            }
            return true;
        } catch (e) {
            console.error("[Bixolon] HTTP Post failed:", e);
            setError('로컬 WebPrint 에이전트 연결 실패 (127.0.0.1:18080)');
            return false;
        }
    };

    const printBadge = async (layout: any, userData: any): Promise<boolean> => {
        setPrinting(true);
        setError(null);
        try {
            const payload = buildPrintData(layout, userData);
            console.log('[Bixolon Renewal] Final Payload:', JSON.stringify(payload));
            const success = await printViaHttp(payload);
            setPrinting(false);
            return success;
        } catch (err) {
            console.error('[Bixolon Renewal] Error:', err);
            setError('시스템 오류');
            setPrinting(false);
            return false;
        }
    };

    const resetPrinter = async (): Promise<boolean> => {
        setPrinting(true);
        setError(null);
        try {
            const payload = {
                id: Math.floor(Math.random() * 1000) + 1,
                functions: {
                    func01: { clearBuffer: [] },
                    func02: { directDrawHex: ['400D'] },
                    func03: { clearBuffer: [] },
                    func04: { setAutoCutter: [1, 0] },
                },
            };
            console.log('[Bixolon Renewal] Reset Payload:', JSON.stringify(payload));
            const success = await printViaHttp(payload);
            setPrinting(false);
            return success;
        } catch (err) {
            console.error('[Bixolon Renewal] Reset Error:', err);
            setError('시스템 오류');
            setPrinting(false);
            return false;
        }
    };

    return { printBadge, resetPrinter, printing, error };
};

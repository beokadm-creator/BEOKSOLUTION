import { useState } from 'react';
import { BadgeElement } from '../types/schema';

// Bixolon Web Print SDK configuration
const SDK_BASE_URL = `http://127.0.0.1:18080/WebPrintSDK`;
const PRINTER_NAME = 'Printer1';

const PX_PER_MM = 3.779527;
const pxToDots = (px: number, dpmm: number) => Math.round(px * (dpmm / PX_PER_MM));
const mmToDots = (mm: number, dpmm: number) => Math.round(mm * dpmm);

const detectLayoutUnit = (layout: {
    width?: number;
    height?: number;
    unit?: 'px' | 'mm';
}): 'px' | 'mm' => {
    if (layout.unit === 'px' || layout.unit === 'mm') return layout.unit;

    const width = layout.width || 0;
    const height = layout.height || 0;
    if (width > 0 && width <= 250 && height > 0 && height <= 350) return 'mm';

    return 'px';
};

const valueToDots = (value: number, dpmm: number, unit: 'px' | 'mm') =>
    unit === 'mm' ? mmToDots(value, dpmm) : pxToDots(value, dpmm);

export const useBixolon = () => {
    const [printing, setPrinting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * 텍스트의 추정 너비를 dots 단위로 계산 (볼드체 특성 반영)
     * 한글 ≈ fontSize * 1.15, 영문/숫자 ≈ fontSize * 0.65
     */
    const estimateTextWidthDots = (text: string, fontDots: number): number => {
        let w = 0;
        for (const ch of text) {
            const code = ch.charCodeAt(0);
            if (code >= 0xAC00 && code <= 0xD7A3) w += fontDots * 1.15;
            else if (code >= 0x4E00 && code <= 0x9FFF) w += fontDots * 1.15;
            else if (code >= 0xFF00 && code <= 0xFFEF) w += fontDots * 1.15;
            else w += fontDots * 0.65;
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
            unit?: 'px' | 'mm';
        },
        userData: {
            name: string; org: string; category?: string;
            license?: string; price?: string; affiliation?: string; qrData: string;
        }
    ) => {
        const dpmm = layout.printerDpmm || 8;
        const unit = detectLayoutUnit(layout);
        const offsetXdots = Math.round((layout.printOffsetXmm || 0) * dpmm);
        const offsetYdots = Math.round((layout.printOffsetYmm || 0) * dpmm);

        const widthDots = valueToDots(layout.width || 400, dpmm, unit);
        const heightDots = valueToDots(layout.height || 600, dpmm, unit);

        const functions: Record<string, any> = {
            "func01": { "clearBuffer": [] },
            "func02": { "setReferencePoint": [0, 0] },
            "func03": { "setDirection": [0] },
            "func04": { "setWidth": [widthDots] },
            "func05": { "setLength": [heightDots, 24, 0, 0] }
        };

        let fIdx = 6;
        for (const el of layout.elements) {
            if (!el.isVisible) continue;

            const baseXDots = valueToDots(el.x, dpmm, unit);
            const baseYDots = valueToDots(el.y, dpmm, unit) + offsetYdots;

            const content = el.type === 'CUSTOM'
                ? (el.content || '')
                : (userData[el.type.toLowerCase() as keyof typeof userData] || '');

            if (el.type === 'QR') {
                const qrSizeDots = valueToDots(el.fontSize || 80, dpmm, unit);
                const qrMag = Math.max(1, Math.min(10, Math.round(qrSizeDots / 28)));
                functions[`func${String(fIdx++).padStart(2, '0')}`] = {
                    "drawQRCode": [
                        userData.qrData || 'NO_DATA', baseXDots + offsetXdots, baseYDots, 1, "M", qrMag, 0
                    ]
                };
            } else if (el.type === 'IMAGE') {
                functions[`func${String(fIdx++).padStart(2, '0')}`] = {
                    "drawBitmap": [
                        content, baseXDots + offsetXdots, baseYDots, valueToDots(el.fontSize || 100, dpmm, unit), 0
                    ]
                };
            } else {
                if (!content) continue;

                const fontDots = valueToDots(el.fontSize || 24, dpmm, unit);
                let lines = [content];
                const lineSpacingDots = fontDots * 0.35; // 기본 줄간격 1.35x

                // 지정된 너비 초과 시 폰트 크기 원본 유지한 채 그대로 줄바꿈(Multi-line)
                if (el.maxWidth) {
                    const maxDots = valueToDots(el.maxWidth, dpmm, unit);
                    const estWidth = estimateTextWidthDots(content, fontDots);

                    if (estWidth > maxDots) {
                        lines = [];
                        let currentLine = '';
                        // 단어를 찢지 않으려면 띄어쓰기로 분리 가능하지만 일단 한 글자씩 밀어내기 방식
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

                // 각 라인별로 드로잉 (가운데 정렬 반영)
                lines.forEach((lineText, lineIdx) => {
                    const currentLineYDots = baseYDots + (lineIdx * (fontDots + lineSpacingDots));
                    let printXDots: number;

                    if (el.textAlign === 'center') {
                        const lineWidthDots = estimateTextWidthDots(lineText, fontDots);
                        if (el.maxWidth) {
                            const maxDots = valueToDots(el.maxWidth, dpmm, unit);
                            // 지정된 영역(x ~ x+maxWidth) 안에서 중앙 정렬
                            const centerXDots = baseXDots + maxDots / 2;
                            printXDots = Math.round(centerXDots - lineWidthDots / 2) + offsetXdots;
                        } else {
                            // 영역 설정이 없으면 캔버스 전체 기준 중앙 정렬
                            printXDots = Math.round((widthDots - lineWidthDots) / 2) + offsetXdots;
                        }
                        printXDots = Math.max(printXDots, offsetXdots);
                    } else {
                        printXDots = baseXDots + offsetXdots;
                    }

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
        
        if (layout.enableCutting) {
            functions[`func${String(fIdx++).padStart(2, '0')}`] = { "cutPaper": [1] };
        }

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
            return response.ok;
        } catch (e) {
            console.error("[Bixolon] HTTP Post failed:", e);
            return false;
        }
    };

    const printBadge = async (layout: any, userData: any): Promise<boolean> => {
        setPrinting(true);
        setError(null);
        try {
            const payload = buildPrintData(layout, userData);
            console.log('[Bixolon] Payload with Offset:', JSON.stringify(payload));
            const success = await printViaHttp(payload);
            setPrinting(false);
            return success;
        } catch (err) {
            console.error('[Bixolon] Error:', err);
            setError('시스템 오류');
            setPrinting(false);
            return false;
        }
    };

    return { printBadge, printing, error };
};

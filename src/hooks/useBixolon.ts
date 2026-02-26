import { useState } from 'react';
import { BadgeElement } from '../types/schema';

// Bixolon Web Print SDK configuration
const SDK_BASE_URL = `http://127.0.0.1:18080/WebPrintSDK`;
const PRINTER_NAME = 'Printer1';

/**
 * 정밀 변환 상수 (DPI 매칭)
 * 1mm = 8 dots (203 DPI)
 * 1mm = 3.779527 px (96 DPI)
 * Factor = 8 / 3.779527 = 2.11666667
 */
const PX_TO_DOTS = 2.11666667;
const pxToDots = (px: number) => Math.round(px * PX_TO_DOTS);

/**
 * 하드웨어 여백 보정 (Calibration)
 * 만약 출력물이 우측으로 쏠린다면 OFFSET_X를 음수값(예: -16 => -2mm)으로 조절합니다.
 */
const GLOBAL_OFFSET_X = -8; // 기본 -1mm 보정 (우측 쏠림 방지)
const GLOBAL_OFFSET_Y = 0;

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
        layout: { width: number; height: number; elements: BadgeElement[]; enableCutting?: boolean },
        userData: {
            name: string; org: string; category?: string;
            license?: string; price?: string; affiliation?: string; qrData: string;
        }
    ) => {
        const widthDots = pxToDots(layout.width || 400);
        const heightDots = pxToDots(layout.height || 600);

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

            const baseXDots = pxToDots(el.x);
            const baseYDots = pxToDots(el.y) + GLOBAL_OFFSET_Y;

            const content = el.type === 'CUSTOM'
                ? (el.content || '')
                : (userData[el.type.toLowerCase() as keyof typeof userData] || '');

            if (el.type === 'QR') {
                const qrSizeDots = pxToDots(el.fontSize || 80);
                const qrMag = Math.max(1, Math.min(10, Math.round(qrSizeDots / 28)));
                functions[`func${String(fIdx++).padStart(2, '0')}`] = {
                    "drawQRCode": [
                        userData.qrData || 'NO_DATA', baseXDots + GLOBAL_OFFSET_X, baseYDots, 1, "M", qrMag, 0
                    ]
                };
            } else if (el.type === 'IMAGE') {
                functions[`func${String(fIdx++).padStart(2, '0')}`] = {
                    "drawBitmap": [
                        content, baseXDots + GLOBAL_OFFSET_X, baseYDots, pxToDots(el.fontSize || 100), 0
                    ]
                };
            } else {
                if (!content) continue;

                const fontDots = pxToDots(el.fontSize || 24);
                let lines = [content];
                const lineSpacingDots = fontDots * 0.35; // 기본 줄간격 1.35x

                // 지정된 너비 초과 시 폰트 크기 원본 유지한 채 그대로 줄바꿈(Multi-line)
                if (el.maxWidth) {
                    const maxDots = pxToDots(el.maxWidth);
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
                            const maxDots = pxToDots(el.maxWidth);
                            // 지정된 영역(x ~ x+maxWidth) 안에서 중앙 정렬
                            const centerXDots = baseXDots + maxDots / 2;
                            printXDots = Math.round(centerXDots - lineWidthDots / 2) + GLOBAL_OFFSET_X;
                        } else {
                            // 영역 설정이 없으면 캔버스 전체 기준 중앙 정렬
                            printXDots = Math.round((widthDots - lineWidthDots) / 2) + GLOBAL_OFFSET_X;
                        }
                        printXDots = Math.max(printXDots, GLOBAL_OFFSET_X); // 음수 방지
                    } else {
                        printXDots = baseXDots + GLOBAL_OFFSET_X;
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

        functions[`func${String(fIdx).padStart(2, '0')}`] = { "printBuffer": [] };
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

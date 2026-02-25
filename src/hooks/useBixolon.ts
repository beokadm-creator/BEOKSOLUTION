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

    const buildPrintData = (
        layout: { width: number; height: number; elements: BadgeElement[]; enableCutting?: boolean },
        userData: {
            name: string;
            org: string;
            category?: string;
            license?: string;
            price?: string;
            affiliation?: string;
            qrData: string;
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

        layout.elements.forEach((el) => {
            if (!el.isVisible) return;

            // ✅ 하드웨어 오프셋 반영 (GLOBAL_OFFSET_X)
            const xDots = pxToDots(el.x) + GLOBAL_OFFSET_X;
            const yDots = pxToDots(el.y) + GLOBAL_OFFSET_Y;

            if (el.type === 'QR') {
                const qrSizeDots = pxToDots(el.fontSize || 80);
                const qrMag = Math.max(1, Math.min(10, Math.round(qrSizeDots / 28)));

                functions[`func${String(fIdx++).padStart(2, '0')}`] = {
                    "drawQRCode": [userData.qrData || 'NO_DATA', xDots, yDots, 1, "M", qrMag, 0]
                };
            } else {
                let content = '';
                switch (el.type) {
                    case 'NAME': content = userData.name; break;
                    case 'ORG': content = userData.org; break;
                    case 'CATEGORY': content = userData.category || ''; break;
                    case 'LICENSE': content = userData.license || ''; break;
                    case 'PRICE': content = userData.price || ''; break;
                    case 'AFFILIATION': content = userData.affiliation || ''; break;
                    case 'CUSTOM': content = el.content || ''; break;
                    default: content = '';
                }

                if (content) {
                    const fontHeightDots = pxToDots(el.fontSize || 24);
                    functions[`func${String(fIdx++).padStart(2, '0')}`] = {
                        "drawTrueTypeFont": [
                            content,
                            xDots,
                            yDots,
                            "Malgun Gothic",
                            fontHeightDots,
                            0, false, true, false, false
                        ]
                    };
                }
            }
        });

        functions[`func${String(fIdx).padStart(2, '0')}`] = { "printBuffer": [] };

        return {
            "id": Math.floor(Math.random() * 1000) + 1,
            "functions": functions
        };
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

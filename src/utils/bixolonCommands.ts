import { BadgeElement } from '../types/schema';

// Renewal: 무조건 mm를 받아서 dots로 변환 (추론/px 로직 전면 폐기)
export const mmToDots = (mm: number, dpmm: number) => Math.round(mm * dpmm);

export const asciiToHex = (text: string) =>
    Array.from(text)
        .map((ch) => ch.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase())
        .join('');

/**
 * 텍스트의 추정 너비를 dots 단위로 계산 (Malgun Gothic Bold 기준)
 */
export const estimateTextWidthDots = (text: string, fontDots: number): number => {
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

export interface PrintLayout {
    width: number;
    height: number;
    elements: BadgeElement[];
    enableCutting?: boolean;
    printerFont?: string;
    printerDpmm?: number;
    printOffsetXmm?: number;
    printOffsetYmm?: number;
    printStartOffsetMm?: number;
    mediaType?: number;
    labelGapMm?: number;
    cutFeedMm?: number;
    marginXMm?: number;
    marginYMm?: number;
    cutPaperType?: 0 | 1;
}

export interface PrintUserData {
    name: string;
    org: string;
    category?: string;
    position?: string;
    license?: string;
    price?: string;
    affiliation?: string;
    qrData: string;
}

export const buildPrintData = (
    layout: PrintLayout,
    userData: PrintUserData
) => {
    const dpmm = layout.printerDpmm || 8; // 203 DPI = 8 dpmm
    
    // Offset (mm -> dots)
    const offsetXdots = mmToDots(layout.printOffsetXmm || 0, dpmm);
    const offsetYdots = mmToDots(layout.printOffsetYmm || 0, dpmm);

    // Hardware Margin (mm -> dots)
    const marginXDots = mmToDots(layout.marginXMm || 0, dpmm);
    const marginYDots = mmToDots(layout.marginYMm || 0, dpmm);
    
    // Paper Size (mm -> dots)
    // 만약 기존 px 데이터(width > 250)가 넘어오면 mm 단위로 변환하여 오작동 방지
    const safeWidthMm = layout.width > 250 ? layout.width / 3.78 : layout.width;
    const safeHeightMm = layout.height > 350 ? layout.height / 3.78 : layout.height;

    const widthDots = mmToDots(safeWidthMm, dpmm);
    const heightDots = mmToDots(safeHeightMm, dpmm);

    const mediaType = layout.mediaType ?? 0;
    const labelGapMm = layout.labelGapMm;
    const effectiveLabelGapMm =
        mediaType === 1 ? 0 : (labelGapMm && labelGapMm > 0 ? labelGapMm : 3);
    const labelGapDots = mmToDots(effectiveLabelGapMm, dpmm);
    const printStartOffsetDots = mmToDots(layout.printStartOffsetMm ?? 0, dpmm);
    const enableCutting = layout.enableCutting ?? true;
    const cutPaperType = layout.cutPaperType ?? 0;
    const printerFont = layout.printerFont || 'Malgun Gothic';

    const functions: Record<string, any> = {
        "func01": { "clearBuffer": [] },
        "func02": { "directDrawHex": [asciiToHex(`CUT${enableCutting ? 1 : 0}\r`)] },
        "func03": { "directDrawHex": [asciiToHex(`CL${heightDots}\r`)] },
        "func04": { "setMargin": [marginXDots, marginYDots] },
        "func05": { "setReferencePoint": [0, 0] },
        "func06": { "setDirection": [0] },
        "func07": { "setWidth": [widthDots] },
        "func08": { "setLength": [heightDots, labelGapDots, mediaType, printStartOffsetDots] },
        "func09": { "setAutoCutter": enableCutting ? [1, cutPaperType] : [0, 0] }
    };

    let fIdx = 10;
    for (const el of layout.elements) {
        if (!el.isVisible) continue;

        // X, Y (mm -> dots)
        // 레거시 px 데이터가 섞여 들어오는 것을 방지하기 위해 x가 200 이상이면 비정상으로 간주하고 mm로 보정
        const safeXMm = el.x > 250 ? el.x / 3.78 : el.x;
        const safeYMm = el.y > 350 ? el.y / 3.78 : el.y;

        const safeFontSizeMm = el.fontSize > 100 && el.type !== 'IMAGE' ? el.fontSize / 3.78 : el.fontSize;

        const baseXDots = mmToDots(safeXMm, dpmm);
        const baseYDots = mmToDots(safeYMm, dpmm) + offsetYdots;

        let content = el.type === 'CUSTOM'
            ? (el.content || '')
            : '';
            
        if (el.type !== 'CUSTOM') {
            const key = el.type.toLowerCase();
            // Special mappings or direct fallback
            if (el.type === 'QR') {
                content = userData.qrData || 'NO_DATA';
            } else {
                content = (userData[key as keyof typeof userData] as string) || '';
            }
        }

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
                        printerFont, fontDots,
                        0, false, true, false, false
                    ]
                };
            });
        }
    }

    functions[`func${String(fIdx++).padStart(2, '0')}`] = { "printBuffer": [] };

    return { "id": Math.floor(Math.random() * 1000) + 1, "functions": functions };
};

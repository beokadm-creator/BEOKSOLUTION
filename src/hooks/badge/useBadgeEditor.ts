import { useState, useRef, useCallback } from 'react';
import { BadgeElement } from '../../types/schema';

export const PX_PER_MM = 3.779527;
export const toMm = (px: number) => parseFloat((px / PX_PER_MM).toFixed(1));
export const toPx = (mm: number) => Math.round(mm * PX_PER_MM);

export const DEFAULT_BADGE_WIDTH_MM = 100;
export const DEFAULT_BADGE_HEIGHT_MM = 240;

export const useBadgeEditor = () => {
    const [elements, setElements] = useState<BadgeElement[]>([]);
    const [canvasSize, setCanvasSize] = useState({
        width: DEFAULT_BADGE_WIDTH_MM,
        height: DEFAULT_BADGE_HEIGHT_MM
    });
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [bgUrl, setBgUrl] = useState<string | undefined>(undefined);
    
    // Printer Settings
    const [printerDpmm, setPrinterDpmm] = useState(8);
    const [printerFont, setPrinterFont] = useState('Malgun Gothic');
    const [printOffsetXmm, setPrintOffsetXmm] = useState(0);
    const [printOffsetYmm, setPrintOffsetYmm] = useState(0);
    const [printStartOffsetMm, setPrintStartOffsetMm] = useState(0);
    const [enableCutting, setEnableCutting] = useState(true);
    const [mediaType, setMediaType] = useState(0); // 0: Gap, 1: Continuous, 2: Black Mark
    const [labelGapMm, setLabelGapMm] = useState(3);
    const [cutFeedMm, setCutFeedMm] = useState(0);
    const [marginXMm, setMarginXMm] = useState(0);
    const [marginYMm, setMarginYMm] = useState(0);

    const prevBadgeLayoutRef = useRef<unknown>(undefined);

    const handleDragStop = useCallback((idx: number, _e: unknown, data: { x: number, y: number }) => {
        setElements(prev => {
            const newEls = [...prev];
            newEls[idx] = { ...newEls[idx], x: toMm(data.x), y: toMm(data.y) };
            return newEls;
        });
        setSelectedIndices(prev => {
            if (!prev.includes(idx)) return [idx];
            return prev;
        });
    }, []);

    const updateElement = useCallback((idx: number, field: keyof BadgeElement, value: unknown) => {
        setElements(prev => {
            const newEls = [...prev];
            newEls[idx] = { ...newEls[idx], [field]: value } as BadgeElement;
            return newEls;
        });
    }, []);

    const addElement = useCallback((type: BadgeElement['type']) => {
        const newElement: BadgeElement = {
            type,
            x: canvasSize.width / 2,
            y: canvasSize.height / 2,
            fontSize: type === 'QR' ? 25 : type === 'IMAGE' ? 50 : 6,
            isVisible: true,
            content: type === 'CUSTOM' ? '텍스트 입력' : undefined,
            textAlign: 'center'
        };
        setElements(prev => {
            const newEls = [...prev, newElement];
            setSelectedIndices([newEls.length - 1]);
            return newEls;
        });
    }, [canvasSize]);

    const removeElement = useCallback((idx: number) => {
        setElements(prev => prev.filter((_, i) => i !== idx));
        setSelectedIndices([]);
    }, []);

    const selectElement = useCallback((idx: number, multi: boolean = false) => {
        setSelectedIndices(prev => {
            if (idx < 0) {
                return [];
            }
            if (multi) {
                return prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx];
            }
            return [idx];
        });
    }, []);

    return {
        elements,
        setElements,
        canvasSize,
        setCanvasSize,
        selectedIndices,
        setSelectedIndices,
        bgUrl,
        setBgUrl,
        printerDpmm, setPrinterDpmm,
        printerFont, setPrinterFont,
        printOffsetXmm, setPrintOffsetXmm,
        printOffsetYmm, setPrintOffsetYmm,
        printStartOffsetMm, setPrintStartOffsetMm,
        enableCutting, setEnableCutting,
        mediaType, setMediaType,
        labelGapMm, setLabelGapMm,
        cutFeedMm, setCutFeedMm,
        marginXMm, setMarginXMm,
        marginYMm, setMarginYMm,
        prevBadgeLayoutRef,
        handleDragStop,
        updateElement,
        addElement,
        removeElement,
        selectElement
    };
};

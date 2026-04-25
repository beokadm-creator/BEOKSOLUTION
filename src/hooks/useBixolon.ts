import { useState } from 'react';
import { buildPrintData, PrintLayout, PrintUserData } from '../utils/bixolonCommands';

// Bixolon Web Print SDK configuration
const SDK_BASE_URL = `http://127.0.0.1:18080/WebPrintSDK`;
const PRINTER_NAME = 'Printer1';

export const useBixolon = () => {
    const [printing, setPrinting] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        } catch (_err) {
            console.error("[Bixolon] HTTP Post failed:", _err);
            setError('로컬 WebPrint 에이전트 연결 실패 (127.0.0.1:18080)');
            return false;
        }
    };

    const printBadge = async (layout: PrintLayout, userData: PrintUserData): Promise<boolean> => {
        setPrinting(true);
        setError(null);
        try {
            const payload = buildPrintData(layout, userData);
            const success = await printViaHttp(payload);
            setPrinting(false);
            return success;
        } catch (_err) {
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
            const success = await printViaHttp(payload);
            setPrinting(false);
            return success;
        } catch (_err) {
            setError('시스템 오류');
            setPrinting(false);
            return false;
        }
    };

    return { printBadge, resetPrinter, printing, error };
};

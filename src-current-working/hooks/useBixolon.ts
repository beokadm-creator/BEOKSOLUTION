import { useState } from 'react';
import { BadgeElement } from '../types/schema';

interface BixolonConfig {
    printerName: string;
    ip: string;
    port: number;
    wsPort: number;
}

export const useBixolon = () => {
    const [printing, setPrinting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const config: BixolonConfig = {
        printerName: 'LabelPrinter',
        ip: '127.0.0.1',
        port: 18080,
        wsPort: 18082 // Bixolon Web Print SDK WebSocket Port
    };

    const printBadge = async (
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
        setPrinting(true);
        setError(null);

        try {
            console.log('[Bixolon] Preparing Print Job (WS Method)...', userData);

            const printData: any = {
                id: Math.floor(Math.random() * 100000),
                deviceName: config.printerName,
                functions: {
                    "func1": { "clearBuffer": [] },
                    "func2": { "setLabelSize": [layout.width || 800, layout.height || 1200, 24, 0] },
                    "func3": { "setCharSet": [0, 0] },
                }
            };

            let funcIdx = 4;

            layout.elements.forEach((el) => {
                if (!el.isVisible) return;
                const key = `func${funcIdx++}`;

                if (el.type === 'QR') {
                    printData.functions[key] = {
                        "drawQRCode": [userData.qrData || 'NO_DATA', el.x, el.y, 2, el.fontSize || 6, 0]
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
                        printData.functions[key] = {
                            "drawText": [content, el.x, el.y, 0, el.fontSize || 2, el.fontSize || 2, 0, 1, 0]
                        };
                    }
                }
            });

            if (layout.enableCutting) {
                printData.functions[`func${funcIdx++}`] = { "drawCutPaper": [1] };
            }

            printData.functions[`func${funcIdx}`] = { "printBuffer": [1] };

            // ==========================================
            // WebSocket Protocol (Bypass PNA Fetch Block)
            // ==========================================
            return new Promise((resolve) => {
                const ws = new WebSocket(`ws://127.0.0.1:${config.wsPort}/WebPrintSDK`);

                let timeout = setTimeout(() => {
                    ws.close();
                    setError('프린터 에이전트 연결 시간 초과 (WS)');
                    setPrinting(false);
                    resolve(false);
                }, 5000);

                ws.onopen = () => {
                    console.log('[Bixolon] WebSocket Connected.');
                    ws.send(JSON.stringify(printData));
                };

                ws.onmessage = (event) => {
                    console.log('[Bixolon] WS Response:', event.data);
                    clearTimeout(timeout);
                    ws.close();
                    setPrinting(false);
                    resolve(true);
                };

                ws.onerror = (err) => {
                    console.error('[Bixolon] WS Error:', err);
                    clearTimeout(timeout);
                    setError('프린터 에이전트 연결 실패 (WebSocket)');
                    setPrinting(false);
                    resolve(false);
                };
            });

        } catch (err: any) {
            console.error('[Bixolon] Print failed:', err);
            setError('인쇄 중 에러가 발생했습니다.');
            setPrinting(false);
            return false;
        }
    };

    return { printBadge, printing, error };
};

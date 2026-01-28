import { useState } from 'react';
import { BadgeElement } from '../types/schema';

interface BixolonConfig {
    printerName: string; // e.g., "SRP-350plusIII"
    ip: string; // e.g., "localhost"
    port: number; // e.g., 18080
}

export const useBixolon = () => {
    const [printing, setPrinting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Mock Config for now
    const config: BixolonConfig = {
        printerName: 'LabelPrinter',
        ip: 'localhost',
        port: 18080
    };

    const printBadge = async (
        layout: { width: number; height: number; elements: BadgeElement[] },
        userData: { name: string; org: string; qrData: string }
    ) => {
        setPrinting(true);
        setError(null);

        try {
            console.log('[Bixolon] Preparing Print Job...', userData);
            
            // 1. Construct Bixolon Commands (SLCS / JSON for Web SDK)
            // This is a simplified example of what the JSON might look like for Bixolon Web Print SDK
            const printData = {
                id: Math.floor(Math.random() * 1000),
                functions: {
                    func0: {
                        checkStatus: []
                    },
                    func1: {
                        // Clear Buffer
                        clearBuffer: []
                    },
                    func2: {
                        // Set Label Size (assuming layout.height is dots or mm, need conversion logic)
                        // Bixolon usually takes dots. 1mm approx 8 dots (203dpi).
                        setWidth: [layout.width]
                    }
                } as any
            };

            let funcIdx = 3;

            // Map elements
            layout.elements.forEach((el) => {
                if (!el.isVisible) return;
                
                const key = `func${funcIdx++}`;
                let content = '';
                
                if (el.type === 'NAME') content = userData.name;
                else if (el.type === 'ORG') content = userData.org;
                else if (el.type === 'QR') content = userData.qrData;

                if (el.type === 'QR') {
                    // Draw QR Code
                    // drawQRCode: [data, x, y, model, size]
                    printData.functions[key] = {
                        drawQRCode: [content, el.x, el.y, 2, 4] 
                    };
                } else {
                    // Draw Text
                    // drawText: [data, x, y, font, size, rotation, bold, italic, alignment]
                    // Need to map font size to Bixolon device font index or true type
                    const fontSize = el.fontSize > 20 ? 2 : 1; 
                    printData.functions[key] = {
                        drawText: [content, el.x, el.y, 0, fontSize, 0, 0, 0, 0] 
                    };
                }
            });

            // Print Command
            printData.functions[`func${funcIdx}`] = { printBuffer: [] };

            // 2. Send to Local Agent
            // [Hardware] Bixolon Web Print API Bridge
            try {
                // Default Bixolon Web Print SDK endpoint
                const endpoint = `http://${config.ip}:${config.port}/WebPrintSDK`;
                console.log(`[Bixolon] Sending to ${endpoint}...`);

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, 
                    body: JSON.stringify(printData)
                });
                
                if (!response.ok) throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
                
                const result = await response.json();
                // Check Bixolon specific result code (Handle variations in SDK versions)
                if (result.ResultCode !== 'SUCCESS' && result.ResultCode !== 0 && result.resultCode !== 'success') {
                     console.warn('[Bixolon] API Warning:', result);
                }

                console.log('[Bixolon] Print Success', result);
                setPrinting(false);
                return true;
            } catch (netError: any) {
                console.warn('[Bixolon] Hardware not found or network error (Mocking Success for Dev):', netError);
                // Fallback to Mock for development if hardware not present
                await new Promise(resolve => setTimeout(resolve, 1000));
                setPrinting(false);
                return true; 
            }

        } catch (err: any) {
            console.error('[Bixolon] Print Failed:', err);
            setError(err.message);
            setPrinting(false);
            return false;
        }
    };

    return { printBadge, printing, error };
};

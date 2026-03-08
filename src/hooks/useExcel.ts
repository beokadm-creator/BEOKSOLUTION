import * as XLSX from 'xlsx';
import { useState } from 'react';
import toast from 'react-hot-toast';

/**
 * 문자열에 깨진 문자(replacement character U+FFFD)가 포함됐는지 확인
 * UTF-8이 아닌 인코딩(EUC-KR 등)을 UTF-8로 읽었을 때 발생함
 */
const hasMojibake = (str: string) => str.includes('\uFFFD');

/**
 * ArrayBuffer를 지정한 인코딩으로 디코딩해 XLSX 워크북으로 파싱
 */
const parseCsvWithEncoding = (buffer: ArrayBuffer, encoding: string): unknown[] => {
    const decoder = new TextDecoder(encoding);
    const text = decoder.decode(buffer);
    const wb = XLSX.read(text, { type: 'string' });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet);
};

export const useExcel = () => {
    const [processing, setProcessing] = useState(false);

    const exportToExcel = (data: Record<string, unknown>[], fileName: string, sheetName: string = 'Sheet1') => {
        setProcessing(true);
        try {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            XLSX.writeFile(wb, `${fileName}.xlsx`);
        } catch (e) {
            console.error('Export Error:', e);
            toast.error('Failed to export Excel');
        } finally {
            setProcessing(false);
        }
    };

    const importFromExcel = (file: File): Promise<unknown[]> => {
        setProcessing(true);
        const isCsv = file.name.toLowerCase().endsWith('.csv');

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const buffer = e.target?.result as ArrayBuffer;

                    if (isCsv) {
                        // CSV: UTF-8로 먼저 시도 → 한글 깨짐 감지 시 EUC-KR(CP949)로 재시도
                        let rows = parseCsvWithEncoding(buffer, 'utf-8');
                        const sampleStr = JSON.stringify(rows.slice(0, 5));
                        if (hasMojibake(sampleStr)) {
                            console.warn('[useExcel] UTF-8 디코딩에서 깨진 문자 감지 → EUC-KR(CP949)로 재시도');
                            rows = parseCsvWithEncoding(buffer, 'euc-kr');
                        }
                        resolve(rows);
                    } else {
                        // xlsx / xls: ArrayBuffer로 직접 파싱 (SheetJS가 인코딩 자동 처리)
                        const wb = XLSX.read(buffer, { type: 'array' });
                        const sheetName = wb.SheetNames[0];
                        const sheet = wb.Sheets[sheetName];
                        const json = XLSX.utils.sheet_to_json(sheet);
                        resolve(json);
                    }
                } catch (err) {
                    console.error('Import Error:', err);
                    reject(err);
                } finally {
                    setProcessing(false);
                }
            };

            reader.onerror = (err) => {
                setProcessing(false);
                reject(err);
            };

            reader.readAsArrayBuffer(file);
        });
    };

    return { exportToExcel, importFromExcel, processing };
};

import * as XLSX from 'xlsx';
import { useState } from 'react';
import toast from 'react-hot-toast';

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

    const importFromExcel = (file: File): Promise<Record<string, unknown>[]> => {
        setProcessing(true);
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const wb = XLSX.read(data, { type: 'binary' });
                    const sheetName = wb.SheetNames[0];
                    const sheet = wb.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(sheet);
                    resolve(json);
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
            reader.readAsBinaryString(file);
        });
    };

    return { exportToExcel, importFromExcel, processing };
};

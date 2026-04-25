import React, { useState, useRef, useEffect } from 'react';

interface MmInputProps {
    valueMm: number | undefined;
    onChange: (mm: number | undefined) => void;
    placeholder?: string;
    step?: number;
    className?: string;
    allowEmpty?: boolean;
    disabled?: boolean;
}

export const MmInput: React.FC<MmInputProps> = ({ 
    valueMm, 
    onChange, 
    placeholder, 
    step = 0.5, 
    className = '', 
    allowEmpty = false, 
    disabled = false 
}) => {
    const [localVal, setLocalVal] = useState<string>(
        valueMm !== undefined ? String(valueMm) : ''
    );

    const isFocused = useRef(false);
    const prevValueMmRef = useRef(valueMm);
    useEffect(() => {
        if (!isFocused.current && valueMm !== prevValueMmRef.current) {
            setTimeout(() => {
                setLocalVal(valueMm !== undefined ? String(valueMm) : '');
            }, 0);
            prevValueMmRef.current = valueMm;
        }
    }, [valueMm]);

    return (
        <input
            type="number"
            step={step}
            value={localVal}
            placeholder={placeholder}
            disabled={disabled}
            className={`border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 ${className}`}
            onFocus={() => { isFocused.current = true; }}
            onChange={e => setLocalVal(e.target.value)}
            onBlur={e => {
                isFocused.current = false;
                const raw = e.target.value.trim();
                if (raw === '' && allowEmpty) {
                    onChange(undefined);
                    setLocalVal('');
                } else {
                    const num = parseFloat(raw);
                    if (!isNaN(num)) {
                        const mm = parseFloat(num.toFixed(1));
                        onChange(mm);
                        setLocalVal(String(mm));
                    }
                }
            }}
        />
    );
};

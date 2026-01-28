import React from 'react';

// Input
interface EregiInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    requiredMark?: boolean;
}

export const EregiInput: React.FC<EregiInputProps> = ({ label, error, requiredMark, className = '', ...props }) => {
    return (
        <div className="w-full">
            {label && (
                <label className={`eregi-label ${requiredMark ? 'eregi-label-required' : ''}`}>
                    {label}
                </label>
            )}
            <input
                className={`eregi-input ${error ? 'border-red-300 ring-red-100' : ''} ${className}`}
                {...props}
            />
            {error && <p className="text-xs text-red-500 mt-1 font-medium">{error}</p>}
        </div>
    );
};

// Button
interface EregiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    isLoading?: boolean;
}

export const EregiButton: React.FC<EregiButtonProps> = ({
    children,
    variant = 'primary',
    isLoading,
    className = '',
    disabled,
    ...props
}) => {

    // Base class mapping based on variant
    const getVariantClass = () => {
        switch (variant) {
            case 'secondary': return 'eregi-btn-secondary';
            case 'outline': return 'border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-eregi px-6 py-2.5 font-medium transition-colors';
            case 'ghost': return 'text-slate-600 hover:bg-slate-100 rounded-eregi px-4 py-2 font-medium transition-colors';
            case 'primary':
            default: return 'eregi-btn-primary';
        }
    };

    return (
        <button
            className={`${getVariantClass()} ${isLoading || disabled ? 'opacity-70 cursor-not-allowed' : ''} ${className}`}
            disabled={isLoading || disabled}
            {...props}
        >
            {isLoading ? (
                <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                </>
            ) : children}
        </button>
    );
};

// Card
export const EregiCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
    return (
        <div className={`eregi-card ${className}`}>
            {children}
        </div>
    );
};

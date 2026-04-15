import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
    text?: string;
    className?: string;
    fullScreen?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    text = "Loading...",
    className = "",
    fullScreen = true
}) => {
    const containerClasses = fullScreen
        ? "flex flex-col items-center justify-center min-h-[50vh] w-full bg-background/80 z-50 py-20"
        : `flex flex-col items-center justify-center p-4 ${className}`;

    return (
        <div className={containerClasses}>
            <div className="flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-eregi-primary animate-spin" />
            </div>
            {text && (
                <p className="mt-4 text-sm font-medium text-muted-foreground animate-pulse">
                    {text}
                </p>
            )}
        </div>
    );
};

export default LoadingSpinner;

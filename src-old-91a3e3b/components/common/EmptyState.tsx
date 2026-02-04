import React from 'react';
import { LucideIcon, FileX, Plus } from 'lucide-react';
import { Button } from '../ui/button';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon = FileX,
    title,
    description,
    actionLabel,
    onAction,
    className = ""
}) => {
    return (
        <div className={`flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 ${className}`}>
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 border border-slate-100">
                <Icon className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
            <p className="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
                {description}
            </p>
            {actionLabel && onAction && (
                <Button onClick={onAction} variant="outline" className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300">
                    {actionLabel === "추가하기" || actionLabel.includes("제출") ? <Plus className="w-4 h-4 mr-2" /> : null}
                    {actionLabel}
                </Button>
            )}
        </div>
    );
};

export default EmptyState;

import React from 'react';
import { Skeleton } from '../ui/skeleton';
import { LucideIcon } from 'lucide-react';

interface DataWidgetProps {
    title: string;
    value: string | number | React.ReactNode;
    icon: LucideIcon;
    loading?: boolean;
    variant?: 'default' | 'primary' | 'success';
    subValue?: string | React.ReactNode;
}

const DataWidget: React.FC<DataWidgetProps> = ({
    title,
    value,
    icon: Icon,
    loading = false,
    variant = 'default',
    subValue
}) => {

    const getStyles = () => {
        switch (variant) {
            case 'primary':
                return {
                    card: "bg-[#003366] border-[#002244]",
                    text: "text-white",
                    subText: "text-[#c3daee]",
                    iconBg: "bg-white/20 text-white backdrop-blur-sm",
                    bigIcon: "text-white/10"
                };
            case 'success':
                return {
                    card: "bg-emerald-600 border-emerald-700",
                    text: "text-white",
                    subText: "text-emerald-100",
                    iconBg: "bg-white/20 text-white backdrop-blur-sm",
                    bigIcon: "text-white/10"
                };
            default:
                return {
                    card: "bg-white border-slate-100",
                    text: "text-slate-900",
                    subText: "text-slate-500",
                    iconBg: "bg-[#f0f5fa] text-[#24669e]",
                    bigIcon: "text-slate-50"
                };
        }
    };

    const styles = getStyles();

    return (
        <div className={`relative overflow-hidden rounded-xl shadow-sm p-6 border ${styles.card} group transition-all duration-300 hover:shadow-md`}>
            {/* Background Decor */}
            <div className={`absolute -right-4 -bottom-4 transform group-hover:scale-110 transition-transform duration-500`}>
                <Icon className={`w-32 h-32 ${styles.bigIcon}`} strokeWidth={1.5} />
            </div>

            <div className="relative z-10 flex justify-between items-start">
                <div>
                    <p className={`text-sm font-semibold mb-1 ${styles.subText}`}>{title}</p>
                    {loading ? (
                        <Skeleton className={`h-8 w-16 bg-current opacity-20`} />
                    ) : (
                        <div className="flex items-end gap-2">
                            <h3 className={`text-3xl font-heading-1 leading-none ${styles.text}`}>{value}</h3>
                            {subValue && <span className={`text-sm font-medium mb-1 ${styles.subText}`}>{subValue}</span>}
                        </div>
                    )}
                </div>

                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${styles.iconBg}`}>
                    <Icon size={24} strokeWidth={2} />
                </div>
            </div>
        </div>
    );
};

export default DataWidget;

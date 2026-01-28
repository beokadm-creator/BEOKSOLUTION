import { cn } from "../../lib/utils"

function Skeleton({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("animate-[pulse_2.5s_cubic-bezier(0.4,0,0.6,1)_infinite] rounded-md bg-slate-200/80", className)}
            {...props}
        />
    )
}

export { Skeleton }

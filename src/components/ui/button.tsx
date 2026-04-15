import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "../../lib/utils"

// Since we didn't install class-variance-authority or radix slot, 
// I will implement a simpler version of Button for now to speed up,
// or I should just use standard props. 
// Wait, user asked for Shadcn/UI style. I'll implement a solid button component 
// without the extra deps if possible, or stick to simple className concatenation.
// Actually, let's keep it simple and robust.

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'eregi-primary' | 'eregi-success' | 'eregi-warning' | 'eregi-error', size?: 'default' | 'sm' | 'lg' | 'icon', asChild?: boolean }>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const variants = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
      // Academic eRegi variants
      "eregi-primary": "bg-eregi-primary text-eregi-primary-foreground hover:bg-eregi-primary-hover shadow-md",
      "eregi-success": "bg-eregi-success text-eregi-success-foreground hover:opacity-90 shadow-md",
      "eregi-warning": "bg-eregi-warning text-eregi-warning-foreground hover:opacity-90 shadow-md",
      "eregi-error": "bg-eregi-error text-eregi-error-foreground hover:opacity-90 shadow-md",
    }
    const sizes = {
      default: "h-10 px-6 py-2",
      sm: "h-9 px-4 text-sm",
      lg: "h-12 px-8 text-lg",
      icon: "h-10 w-10",
    }
    return (
      <Comp
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background btn-academic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 gap-2",
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }

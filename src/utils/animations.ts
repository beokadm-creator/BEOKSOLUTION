/**
 * Academic Elegance Animation System
 * Refined, purposeful animations for scholarly interfaces
 */

// Academic Elegance easing curves - refined, not bouncy
export const EASING = {
  // Primary curves for Academic Elegance
  subtle: 'cubic-bezier(0.25, 1, 0.5, 1)',      // Gentle, scholarly
  refined: 'cubic-bezier(0.22, 1, 0.36, 1)',    // Confident, elegant
  decisive: 'cubic-bezier(0.16, 1, 0.3, 1)',    // Authoritative

  // Avoid these - too playful for academic context
  // bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  // elastic: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
} as const;

// Academic Elegance timing - purposeful durations
export const DURATION = {
  instant: '100ms',    // Button feedback
  quick: '200ms',      // Hover states
  smooth: '300ms',     // State transitions
  elegant: '400ms',    // Content reveals
  entrance: '500ms',   // Page load choreography
} as const;

// Intersection Observer for scroll-triggered animations
export const createScrollObserver = (
  callback: (entries: IntersectionObserverEntry[]) => void,
  options?: IntersectionObserverInit
) => {
  const defaultOptions: IntersectionObserverInit = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px', // Trigger slightly before entering viewport
    ...options,
  };

  return new IntersectionObserver(callback, defaultOptions);
};

// Animation class generators for consistent implementation
export const fadeInUp = (delay = 0) => ({
  initial: 'opacity-0 translate-y-4',
  animate: 'opacity-100 translate-y-0',
  transition: `transition-all duration-[${DURATION.elegant}] delay-[${delay}ms] ease-[${EASING.refined}]`,
});

export const fadeIn = (delay = 0) => ({
  initial: 'opacity-0',
  animate: 'opacity-100',
  transition: `transition-opacity duration-[${DURATION.smooth}] delay-[${delay}ms] ease-[${EASING.subtle}]`,
});

export const scaleIn = (delay = 0) => ({
  initial: 'opacity-0 scale-95',
  animate: 'opacity-100 scale-100',
  transition: `transition-all duration-[${DURATION.elegant}] delay-[${delay}ms] ease-[${EASING.refined}]`,
});

// Academic button interactions
export const academicButtonHover = {
  base: 'transition-all duration-[200ms] ease-[cubic-bezier(0.25,1,0.5,1)]',
  hover: 'hover:scale-[1.02] hover:shadow-lg hover:-translate-y-0.5',
  active: 'active:scale-[0.98] active:translate-y-0',
  focus: 'focus-visible:ring-2 focus-visible:ring-eregi-primary/20 focus-visible:outline-none',
};

// Reduced motion support
export const prefersReducedMotion = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Apply animation classes conditionally based on reduced motion preference
export const applyAnimation = (animationClasses: string, fallback = '') => {
  if (prefersReducedMotion()) {
    return fallback;
  }
  return animationClasses;
};
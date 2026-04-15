import { useEffect, useRef } from 'react';
import { createScrollObserver } from '../utils/animations';

/**
 * Hook for Academic Elegance scroll-triggered animations
 * Adds animation classes when elements enter viewport
 */
export const useScrollAnimation = (
  animationClass: string = 'animate-fade-in-up',
  options?: IntersectionObserverInit
) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Add initial animation class
    element.setAttribute('data-scroll', 'true');
    element.classList.add(animationClass);

    // Create observer to trigger animation
    const observer = createScrollObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          // Once animated, we can stop observing this element
          observer.unobserve(entry.target);
        }
      });
    }, options);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [animationClass, options]);

  return ref;
};

/**
 * Hook for staggered child animations
 * Animates children with progressive delays
 */
export const useStaggeredAnimation = (
  staggerDelay: number = 100,
  animationClass: string = 'animate-fade-in-up'
) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Add stagger class to parent
    element.classList.add('stagger-children');

    // Add animation classes to children with delays
    const children = Array.from(element.children) as HTMLElement[];
    children.forEach((child, index) => {
      child.setAttribute('data-scroll', 'true');
      child.classList.add(animationClass);
      child.style.setProperty('--stagger-delay', index.toString());
    });

    // Trigger animations when parent enters viewport
    const observer = createScrollObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Add visible class to all children
          children.forEach((child) => {
            child.classList.add('is-visible');
          });
          observer.unobserve(entry.target);
        }
      });
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [staggerDelay, animationClass]);

  return ref;
};

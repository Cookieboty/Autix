'use client';

import { useEffect, useState, type RefObject } from 'react';

export function useElementHeight<T extends HTMLElement>(ref: RefObject<T | null>) {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const updateHeight = () => {
      setHeight(element.getBoundingClientRect().height);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    window.addEventListener('resize', updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [ref]);

  return height;
}

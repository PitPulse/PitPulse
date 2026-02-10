"use client";

import { useEffect, useState, useCallback } from "react";

export function RouteLoading() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const startLoading = useCallback(() => {
    setLoading(true);
    setProgress(0);
  }, []);

  const stopLoading = useCallback(() => {
    setProgress(100);
    setTimeout(() => {
      setLoading(false);
      setProgress(0);
    }, 300);
  }, []);

  useEffect(() => {
    // Animate progress while loading
    if (!loading) return;

    let frame: number;
    let current = 0;

    const tick = () => {
      // Fast at first, then slow down — never reaches 100 on its own
      current += (90 - current) * 0.03;
      setProgress(current);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [loading]);

  useEffect(() => {
    // Intercept link clicks to detect navigation
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Only handle internal navigation links
      const isInternal =
        href.startsWith("/") || href.startsWith(window.location.origin);
      const isAnchor = href.startsWith("#");
      const isNewTab =
        anchor.target === "_blank" || e.metaKey || e.ctrlKey;

      if (isInternal && !isAnchor && !isNewTab) {
        // Don't start loading if we're already on this page
        if (href === window.location.pathname) return;
        startLoading();
      }
    };

    // Detect when navigation completes (URL changes)
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        stopLoading();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
      observer.disconnect();
    };
  }, [startLoading, stopLoading]);

  if (!loading && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 z-[100] h-0.5 w-full">
      <div
        className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

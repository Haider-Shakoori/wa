'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function NavigationProgress() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  useEffect(() => { setPending(false); }, [pathname]);
  useEffect(() => {
    let fallback: ReturnType<typeof setTimeout>;
    function start(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element)?.closest('a');
      if (!link || link.target || link.hasAttribute('download')) return;
      const destination = new URL(link.href, location.href);
      if (destination.origin !== location.origin || destination.pathname === location.pathname) return;
      setPending(true);
      clearTimeout(fallback);
      fallback = setTimeout(() => setPending(false), 15000);
    }
    document.addEventListener('click', start, true);
    return () => { document.removeEventListener('click', start, true); clearTimeout(fallback); };
  }, []);
  return pending ? <div className="rw-navigation-progress" role="progressbar" aria-label="Loading page"/> : null;
}

/**
 * Applies the `printing-mode` CSS class to document.body which hides the sidebar,
 * header, input forms, and action buttons, leaving ONLY the A4 printable document container visible,
 * then triggers Desktop Electron IPC printDocument (when running in Electron) or window.print().
 */
export function triggerPrintDocument(): void {
  document.body.classList.add('printing-mode');

  const cleanup = () => {
    document.body.classList.remove('printing-mode');
    window.removeEventListener('afterprint', cleanup);
  };

  setTimeout(async () => {
    if (typeof window !== 'undefined' && typeof window.electronAPI?.printDocument === 'function') {
      try {
        const result = await window.electronAPI.printDocument({
          silent: false,
          printBackground: true,
        });
        if (result && !result.success && result.error && result.error !== 'cancelled') {
          console.warn('[printDocument] Electron print failed:', result.error);
        }
      } catch (err) {
        console.warn('[printDocument] Electron print IPC error:', err);
      } finally {
        cleanup();
      }
      return;
    }

    window.addEventListener('afterprint', cleanup);

    try {
      window.print();
    } finally {
      // Fallback cleanup in case afterprint does not fire in sandboxed environments
      setTimeout(cleanup, 1200);
    }
  }, 80);
}

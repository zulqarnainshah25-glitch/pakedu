/**
 * Mobile & WebView-Compatible File Saver Utility
 * Supports Capacitor Native Filesystem, Web Share API (Android Native Share sheet),
 * and standard Blob ObjectURL anchor downloads.
 */
export async function saveFileUniversal(
  blob: Blob,
  fileName: string,
  mimeType: string
): Promise<void> {
  // Strategy 1: Check for Capacitor native runtime
  try {
    const win = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : null;
    const capacitor = win?.Capacitor as { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> } | undefined;
    if (capacitor && typeof capacitor.isNativePlatform === 'function' && capacitor.isNativePlatform()) {
      const filesystem = capacitor.Plugins?.Filesystem as {
        writeFile?: (opts: { path: string; data: string; directory?: string; recursive?: boolean }) => Promise<unknown>;
      } | undefined;

      if (filesystem && typeof filesystem.writeFile === 'function') {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const resultStr = reader.result as string;
            const base64 = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        await filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: 'DOCUMENTS',
          recursive: true
        });
        return;
      }
    }
  } catch (capErr) {
    console.warn('[mobileFileSaver] Capacitor native save fallback:', capErr);
  }

  // Strategy 2: Web Share API for Mobile Android browsers & WebViews
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], fileName, { type: mimeType });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: fileName
        });
        return;
      }
    } catch (shareErr) {
      // AbortError indicates user dismissed share sheet
      if (shareErr instanceof Error && shareErr.name === 'AbortError') {
        return;
      }
    }
  }

  // Strategy 3: Standard Web Anchor click download
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    try {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      // Ignore cleanup error
    }
  }, 1200);
}

import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { saveFileUniversal } from '../features/cv-builder/lib/mobileFileSaver';

/**
 * Captures any printable A4 DOM node (`.printable-a4-sheet` or letter/certificate ref)
 * inside an isolated light-mode A4 (794px) wrapper and downloads/shares it as a PDF
 * via the cross-platform Capacitor / Web Share / Web Blob mobileFileSaver.
 */
export async function exportA4ElementAsPdf(
  sourceElement: HTMLElement,
  fileName: string
): Promise<void> {
  const safeName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.top = '0';
  wrapper.style.left = '-10000px';
  wrapper.style.width = '794px';
  wrapper.style.minHeight = '1123px';
  wrapper.style.background = '#ffffff';
  wrapper.style.color = '#0f172a';
  wrapper.style.zIndex = '-9999';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.padding = '0';
  wrapper.style.margin = '0';
  wrapper.style.overflow = 'visible';

  const clone = sourceElement.cloneNode(true) as HTMLElement;
  clone.style.width = '794px';
  clone.style.minWidth = '794px';
  clone.style.maxWidth = '794px';
  clone.style.margin = '0';
  clone.style.background = '#ffffff';
  clone.style.color = '#0f172a';
  clone.style.boxShadow = 'none';
  clone.style.borderRadius = '0';

  // Strip .no-print interactive controls inside cloned sheet if any
  clone.querySelectorAll('.no-print').forEach((el) => el.remove());

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      width: 794,
      windowWidth: 794,
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidthMm = pdf.internal.pageSize.getWidth(); // 210mm
    const pageHeightMm = pdf.internal.pageSize.getHeight(); // 297mm
    const marginX = 6;
    const marginY = 6;
    const usableWidthMm = pageWidthMm - marginX * 2;
    const usableHeightMm = pageHeightMm - marginY * 2;
    const rawImgHeightMm = (canvas.height * usableWidthMm) / canvas.width;

    if (rawImgHeightMm <= usableHeightMm * 1.12) {
      const scaleFactor = rawImgHeightMm > usableHeightMm ? usableHeightMm / rawImgHeightMm : 1;
      const finalWidthMm = usableWidthMm * scaleFactor;
      const finalHeightMm = rawImgHeightMm * scaleFactor;
      const centeredX = marginX + (usableWidthMm - finalWidthMm) / 2;
      const imgData = canvas.toDataURL('image/jpeg', 0.96);
      pdf.addImage(imgData, 'JPEG', centeredX, marginY, finalWidthMm, finalHeightMm);
    } else {
      const pxPerMm = canvas.width / usableWidthMm;
      const pageSliceHeightPx = Math.floor(usableHeightMm * pxPerMm);
      let currentY = 0;
      let pageIndex = 0;

      while (currentY < canvas.height - 8) {
        if (pageIndex > 0) pdf.addPage();
        const sliceHeightPx = Math.min(pageSliceHeightPx, canvas.height - currentY);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeightPx;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(canvas, 0, currentY, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
          const sliceData = pageCanvas.toDataURL('image/jpeg', 0.96);
          pdf.addImage(sliceData, 'JPEG', marginX, marginY, usableWidthMm, (sliceHeightPx * usableWidthMm) / canvas.width);
        }
        currentY += sliceHeightPx;
        pageIndex++;
      }
    }

    const pdfBlob = pdf.output('blob');
    await saveFileUniversal(pdfBlob, safeName, 'application/pdf');
  } finally {
    wrapper.remove();
  }
}

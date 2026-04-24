import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { TextItem as PDFTextItem } from 'pdfjs-dist/types/src/display/api';

// 使用 CDN 方式加载 PDF.js worker，避免本地文件的 MIME 类型问题
GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.5.207/build/pdf.worker.mjs';

export interface TextItem {
  str: string;
  x: number;
  y: number;
  w: number;
  page: number;
}

export async function extractTextWithCoords(file: File): Promise<TextItem[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = getDocument({
    data: arrayBuffer,
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.5.207/cmaps/',
    cMapPacked: true,
  });

  const pdf = await loadingTask.promise;
  let allItems: TextItem[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    const pageItems: TextItem[] = textContent.items
      .filter((item): item is PDFTextItem => 'str' in item && typeof item.str === 'string' && item.str.trim() !== '')
      .map((item) => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        w: item.width,
        page: i
      }));

    allItems = [...allItems, ...pageItems];
  }
  return allItems;
}



export async function extractRawTextForDetection(file: File): Promise<string> {
  const items = await extractTextWithCoords(file);
  // 真正的逐行提取，不做任何排序或优化，保持原始文本排列
  // 按页面和Y坐标分组，保持原始顺序
  const pageGroups: {[page: number]: TextItem[]} = {};
  
  for (const item of items) {
    if (!pageGroups[item.page]) {
      pageGroups[item.page] = [];
    }
    pageGroups[item.page].push(item);
  }
  
  let text = '';
  const pageNumbers = Object.keys(pageGroups).map(Number).sort((a, b) => a - b);
  
  for (const pageNum of pageNumbers) {
    const pageItems = pageItemsByY(pageGroups[pageNum]);
    
    for (const lineItems of pageItems) {
      // 按X坐标排序，保持原始左右顺序
      const sortedLine = [...lineItems].sort((a, b) => a.x - b.x);
      const lineText = sortedLine.map(item => item.str).join(' ');
      text += lineText + '\n';
    }
  }
  
  return text.trim();
}

function pageItemsByY(items: TextItem[]): TextItem[][] {
  // 按Y坐标分组，Y坐标相近的视为同一行
  const lines: TextItem[][] = [];
  let currentLine: TextItem[] = [];
  let currentY: number | null = null;
  
  for (const item of items) {
    if (currentY === null) {
      currentY = item.y;
      currentLine.push(item);
    } else if (Math.abs(item.y - currentY) <= 15) {
      currentLine.push(item);
    } else {
      lines.push(currentLine);
      currentLine = [item];
      currentY = item.y;
    }
  }
  
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  
  return lines;
}

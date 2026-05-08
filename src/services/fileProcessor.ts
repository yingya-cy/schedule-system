import { extractRawTextForDetection } from '../utils/pdfParser';
import { ProcessResult, UnifiedCourse, PdfType, ScheduleType } from '../types';
import { mapBackendDataToArray } from '../utils/dataMappers';

export const detectPdfType = async (file: File): Promise<PdfType> => {
  const detectionText = await extractRawTextForDetection(file);
  const tightDaysPattern = /星期一\s*星期二\s*星期三\s*星期四\s*星期五/i;
  const rawTextCompact = detectionText.replace(/[\n\t]/g, ' ');
  
  if (tightDaysPattern.test(rawTextCompact) || rawTextCompact.includes('时间段 节次')) {
    return 'vertical';
  } else {
    return 'horizontal';
  }
};

export const detectScheduleType = async (file: File): Promise<ScheduleType> => {
  const img = new Image() as any;
  img.src = URL.createObjectURL(file);
  await new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = () => resolve(null);
  });
  
  const ratio = img.width / img.height;
  return ratio > 1.8 ? 'dense_wide' : 'standard';
};

export const processImageFile = async (file: File, signal?: AbortSignal): Promise<ProcessResult> => {
  try {
    const scheduleType = await detectScheduleType(file);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('schedule_type', scheduleType);
    
    const response = await fetch('/api/ocr/image', {
      method: 'POST',
      body: formData,
      signal,
    });
    
    if (!response.ok) {
      throw new Error(`图片处理失败 (${response.status})`);
    }
    
    const result = await response.json();
    if (result.success && result.schedule_data && result.schedule_data.length > 0) {
      return {
        filename: file.name,
        success: true,
        courses: mapBackendDataToArray(result.schedule_data),
        rawJsonText: result.raw_json_text
      };
    } else {
      throw new Error(result.error || '图片识别未提取到课程数据');
    }
  } catch (error: unknown) {
    if ((error as any).name === 'AbortError') {
      return {
        filename: file.name,
        success: false,
        error: '识别已中断'
      };
    }
    console.error(`处理图片文件 ${file.name} 失败:`, error);
    return {
      filename: file.name,
      success: false,
      error: (error as Error).message || '未知错误'
    };
  }
};

export const processVerticalPdf = async (file: File, signal?: AbortSignal): Promise<ProcessResult> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('schedule_type', 'standard');
    
    const response = await fetch('/api/ocr/pdf', {
      method: 'POST',
      body: formData,
      signal,
    });
    
    if (!response.ok) {
      throw new Error(`竖型PDF解析失败 (${response.status})`);
    }
    
    const result = await response.json();
    if (result.success && result.schedule_data && result.schedule_data.length > 0) {
      return {
        filename: file.name,
        success: true,
        courses: mapBackendDataToArray(result.schedule_data),
        rawJsonText: result.raw_json_text
      };
    } else {
      throw new Error(result.error || '竖型PDF解析未提取到课程数据');
    }
  } catch (error: unknown) {
    if ((error as any).name === 'AbortError') {
      return {
        filename: file.name,
        success: false,
        error: '识别已中断'
      };
    }
    console.error(`处理竖型PDF ${file.name} 失败:`, error);
    return {
      filename: file.name,
      success: false,
      error: (error as Error).message || '未知错误'
    };
  }
};

export const processHorizontalPdf = async (file: File, signal?: AbortSignal): Promise<ProcessResult> => {
  try {
    const detectionText = await extractRawTextForDetection(file);
    
    const response = await fetch('/api/ocr/horizontal_rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: detectionText }),
      signal,
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.schedule_data && result.schedule_data.length > 0) {
        return {
          filename: file.name,
          success: true,
          courses: mapBackendDataToArray(result.schedule_data)
        };
      }
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('schedule_type', 'standard');
    
    const aiResponse = await fetch('/api/ocr/pdf', {
      method: 'POST',
      body: formData,
      signal,
    });
    
    if (!aiResponse.ok) {
      throw new Error(`横型PDFAI处理失败 (${aiResponse.status})`);
    }
    
    const aiResult = await aiResponse.json();
    if (aiResult.success && aiResult.schedule_data && aiResult.schedule_data.length > 0) {
      return {
        filename: file.name,
        success: true,
        courses: mapBackendDataToArray(aiResult.schedule_data),
        rawJsonText: aiResult.raw_json_text
      };
    } else {
      throw new Error(aiResult.error || '横型PDFAI处理未提取到课程数据');
    }
  } catch (error: unknown) {
    if ((error as any).name === 'AbortError') {
      return {
        filename: file.name,
        success: false,
        error: '识别已中断'
      };
    }
    console.error(`处理横型PDF ${file.name} 失败:`, error);
    return {
      filename: file.name,
      success: false,
      error: (error as Error).message || '未知错误'
    };
  }
};

export const processSingleFile = async (file: File, signal?: AbortSignal): Promise<ProcessResult> => {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage = !isPdf;

  if (isImage) {
    return await processImageFile(file, signal);
  } else if (isPdf) {
    const pdfType = await detectPdfType(file);
    
    if (pdfType === 'vertical') {
      return await processVerticalPdf(file, signal);
    } else {
      return await processHorizontalPdf(file, signal);
    }
  } else {
    return {
      filename: file.name,
      success: false,
      error: '不支持的文件格式'
    };
  }
};

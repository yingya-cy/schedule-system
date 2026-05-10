from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
load_dotenv()
import os
import tempfile
import logging
from PIL import Image
import json
import re

# 导入提示词模块
from prompts.standard_prompts import STANDARD_PROMPTS
from prompts.dense_wide_prompts import DENSE_WIDE_PROMPTS

# 导入工具模块
from utils.cleaner import clean_schedule_ultimate, enrich_footer_courses
from utils.pdf_plumber_parser import parse_vertical_pdf_with_plumber
from utils.rule_parser import parse_by_rules
from utils.image_utils import calculate_dynamic_timeout, auto_detect_schedule_type, encode_image_to_base64
from utils.ai_client import create_ark_client, AI_MODEL, strip_thinking
from utils.excel_parser import parse_excel_for_template, parse_excel_for_contestants, fill_template_with_results

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024


# ==========================================
# 核心大模型 Prompt 提示词字典（从单独文件导入）
# ==========================================
# 合并普通课表和超宽课表提示词
PROMPTS = {}
PROMPTS.update(STANDARD_PROMPTS)
PROMPTS.update(DENSE_WIDE_PROMPTS)


def extract_direct_json(image_path, schedule_type='standard', timeout=300.0):
    try:
        base64_image = encode_image_to_base64(image_path)
        logger.info(f"💎 Calling Doubao Direct-JSON API for {os.path.basename(image_path)}，课表类型: {schedule_type}，超时: {timeout:.1f}秒...")
        
        # 根据课表类型选择提示词
        if schedule_type == 'dense_wide':
            prompt = PROMPTS.get('dense_wide')
            logger.info("使用超宽课表专用提示词进行Direct-JSON提取")
        else:
            prompt = PROMPTS.get('standard')
            logger.info("使用普通课表提示词进行Direct-JSON提取")
        
        # 使用动态超时创建客户端
        dynamic_client = create_ark_client(timeout)
        
        response = dynamic_client.chat.completions.create(
            model=AI_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        },
                    ],
                }
            ],
            temperature=0.01,
        )
        
        content = response.choices[0].message.content
        logger.info(f"AI Raw response: {content[:300]}...")

        cleaned = strip_thinking(content)
        json_match = re.search(r'(\[[\s\S]*\])', cleaned)
        if json_match:
            raw_json_text = json_match.group(1)
            courses = json.loads(raw_json_text)
            enriched_courses = enrich_footer_courses(courses)
            
            # 仅对超宽课表应用终极清洗算法
            if schedule_type == 'dense_wide':
                logger.info("对超宽课表应用终极清洗算法")
                cleaned_courses = clean_schedule_ultimate(enriched_courses)
                return {
                    'raw_json_text': raw_json_text,
                    'raw_data': courses,
                    'schedule_data': cleaned_courses
                }
            else:
                return {
                    'raw_json_text': raw_json_text,
                    'raw_data': courses,
                    'schedule_data': enriched_courses
                }
        return None
    except Exception as e:
        logger.error(f"❌ Direct-JSON extraction failed: {e}")
        return None


# ==========================================
# API 路由
# ==========================================
@app.route('/health', methods=['GET'])
def health(): return jsonify({'status': 'ok'})

@app.route('/api/ocr/image', methods=['POST'])
def ocr_image():
    temp_image_paths, original_temp_path = [], None
    try:
        if 'file' not in request.files: return jsonify({'error': 'No file'}), 400
        file = request.files['file']
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            file.save(temp_file.name); original_temp_path = temp_file.name
        
        # 自动检测课表类型（前端已移除手动指定选项）
        schedule_type = auto_detect_schedule_type(original_temp_path)
        logger.info(f"自动检测课表类型: {schedule_type}")
        
        with Image.open(original_temp_path) as img:
            w, h = img.size
            ratio = w / h
        
        # 计算动态超时时间
        dynamic_timeout = calculate_dynamic_timeout(w, h)
        
        # 直接使用原始图片路径，不再进行切片
        temp_image_paths = [original_temp_path]

        final_data, raw_data, raw_json_texts = [], [], []
        for path in temp_image_paths:
            res = extract_direct_json(path, schedule_type, dynamic_timeout)
            if res: 
                final_data.extend(res['schedule_data'])
                raw_data.extend(res['raw_data'])
                raw_json_texts.append(res['raw_json_text'])

        # 添加诊断信息
        diagnostic_info = {
            'success': True,
            'schedule_data': final_data,
            'raw_data': raw_data,
            'raw_json_text': '\n\n'.join(raw_json_texts) if raw_json_texts else '',
            'page_count': len(temp_image_paths),
            'diagnostics': {
                'has_raw_data': len(raw_data) > 0,
                'raw_data_count': len(raw_data),
                'has_raw_json': len(raw_json_texts) > 0,
                'raw_json_count': len(raw_json_texts),
                'image_count': len(temp_image_paths),
                'image_sliced': False,  # 不再进行图片切片
                'processing_time_estimate': '正常' if len(final_data) > 0 else '快速完成但无数据数据'
            }
        }
        
        # 如果最终数据为空，记录警告日志
        if len(final_data) == 0:
            logger.warning(f"OCR处理完成但未提取到课程数据。诊断信息: {diagnostic_info['diagnostics']}")
            if len(raw_data) > 0:
                logger.warning(f"原始数据存在但被过滤: {len(raw_data)}条记录")
            else:
                logger.warning("AI识别返回空数据，可能图片无法识别")
        
        return jsonify(diagnostic_info)
    except Exception as e: logger.error(f"OCR image error: {str(e)}"); return jsonify({'error': str(e)}), 500
    finally:
        if original_temp_path and os.path.exists(original_temp_path): os.unlink(original_temp_path)
        for p in temp_image_paths:
            if p != original_temp_path and os.path.exists(p): os.unlink(p)

@app.route('/api/ocr/pdf', methods=['POST'])
def ocr_pdf():
    temp_pdf_path = None
    temp_image_paths = []
    try:
        file = request.files['file']
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            file.save(temp_file.name); temp_pdf_path = temp_file.name

        # 先尝试本地规则识别
        try:
            records = parse_vertical_pdf_with_plumber(temp_pdf_path)
            if records and len(records) > 0:
                logger.info("PDF本地规则识别成功")
                return jsonify({'success': True, 'schedule_data': records, 'parse_method': 'pdfplumber'})
        except Exception as e:
            logger.warning(f"PDF本地规则识别失败: {e}")
        
        # 如果本地规则识别失败或返回空结果，尝试转换为图片并用AI识别
        logger.info("本地规则识别失败，尝试转换为图片并用AI识别...")
        
        try:
            # 使用PyMuPDF将PDF转换为图片（不需要poppler依赖）
            import fitz  # PyMuPDF
            
            logger.info(f"使用PyMuPDF打开PDF: {temp_pdf_path}")
            pdf_document = fitz.open(temp_pdf_path)
            logger.info(f"PDF共 {len(pdf_document)} 页")
            
            images = []
            for page_num in range(len(pdf_document)):
                page = pdf_document[page_num]
                # 设置较高的DPI以获得清晰的图片
                mat = fitz.Matrix(200/72, 200/72)  # 200 DPI
                pix = page.get_pixmap(matrix=mat)
                
                # 转换为PIL Image
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                images.append(img)
                logger.info(f"转换第 {page_num + 1} 页: {pix.width}x{pix.height}")
            
            pdf_document.close()
            logger.info(f"PDF转换为 {len(images)} 张图片")
            
            # 保存图片到临时文件
            for idx, image in enumerate(images):
                temp_image = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
                image.save(temp_image.name, 'PNG')
                temp_image_paths.append(temp_image.name)
                logger.info(f"保存图片 {idx + 1}: {temp_image.name}")
            
            # 使用豆包模型识别每张图片
            final_data, raw_data, raw_json_texts = [], [], []
            for image_path in temp_image_paths:
                # 获取图片尺寸
                with Image.open(image_path) as img:
                    width, height = img.size
                
                # 自动检测课表类型
                schedule_type = auto_detect_schedule_type(image_path)
                dynamic_timeout = calculate_dynamic_timeout(width, height)
                
                res = extract_direct_json(image_path, schedule_type, dynamic_timeout)
                if res: 
                    final_data.extend(res['schedule_data'])
                    raw_data.extend(res['raw_data'])
                    raw_json_texts.append(res['raw_json_text'])
            
            if final_data:
                logger.info(f"AI识别成功，提取到 {len(final_data)} 条课程")
                return jsonify({
                    'success': True, 
                    'schedule_data': final_data, 
                    'parse_method': 'ai_image',
                    'page_count': len(images)
                })
            else:
                logger.warning("AI识别也未能提取到课程数据")
                return jsonify({'success': False, 'error': '无法识别PDF内容，请检查文件是否清晰'}), 400
                
        except ImportError:
            logger.error("PyMuPDF库未安装，无法转换PDF为图片")
            return jsonify({'success': False, 'error': 'PDF识别失败：缺少PyMuPDF库，请运行 pip install PyMuPDF'}), 500
        except Exception as e:
            logger.error(f"PDF转图片识别失败: {e}")
            return jsonify({'success': False, 'error': f'PDF识别失败: {str(e)}'}), 400
            
    except Exception as e:
        logger.error(f"OCR PDF处理错误: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        # 强制垃圾回收，释放文件句柄
        import gc
        gc.collect()
        
        # 添加小延迟，确保文件句柄完全释放
        import time
        time.sleep(0.1)
        
        if temp_pdf_path and os.path.exists(temp_pdf_path):
            try:
                os.unlink(temp_pdf_path)
            except Exception as e:
                logger.warning(f"删除临时PDF文件失败: {e}")
        
        for p in temp_image_paths:
            if os.path.exists(p):
                try:
                    os.unlink(p)
                except Exception as e:
                    logger.warning(f"删除临时图片文件失败: {e}")

@app.route('/api/ocr/horizontal_rules', methods=['POST'])
def ocr_horizontal_rules():
    try:
        # 接收前端传过来的原始文本
        data = request.json
        text = data.get('text', '')
        if not text:
            return jsonify({'success': False, 'error': 'No text provided'}), 400
            
        records = parse_by_rules(text)
        if records:
            logger.info("横型PDF规则解析成功")
            return jsonify({'success': True, 'schedule_data': records, 'parse_method': 'rule_parser'})
        else:
            logger.warning("横型PDF规则解析返回空结果")
            return jsonify({'success': False, 'error': '未提取到课程数据'}), 400
    except Exception as e:
        logger.error(f"横型PDF规则解析失败: {e}")
        return jsonify({'success': False, 'error': f'解析失败: {str(e)}'}), 500

@app.route('/api/ocr/batch', methods=['POST'])
def ocr_batch():
    try:
        files = request.files.getlist('files')
        results = []
        for file in files:
            is_pdf = file.filename.lower().endswith('.pdf')
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf' if is_pdf else os.path.splitext(file.filename)[1]) as tmp:
                file.save(tmp.name); t_path = tmp.name
            try:
                if is_pdf:
                    # PDF文件只使用本地规则识别
                    try:
                        records = parse_vertical_pdf_with_plumber(t_path)
                        if records:
                            results.append({'filename': file.filename, 'success': True, 'schedule_data': records, 'parse_method': 'pdfplumber'})
                        else:
                            results.append({'filename': file.filename, 'success': False, 'error': 'PDF本地规则识别返回空结果'})
                    except Exception as e:
                        results.append({'filename': file.filename, 'success': False, 'error': f'PDF本地规则识别失败: {str(e)}'})
                else:
                    # 图片文件自动判断课表类型
                    schedule_type = auto_detect_schedule_type(t_path)
                    logger.info(f"文件 {file.filename} 自动检测课表类型: {schedule_type}")
                    
                    # 计算动态超时时间
                    with Image.open(t_path) as img:
                        w, h = img.size
                    
                    dynamic_timeout = calculate_dynamic_timeout(w, h)
                    
                    # 直接使用原始图片路径，不再进行切片
                    paths = [t_path]
                    
                    all_d, all_raw, all_raw_json_texts = [], [], []
                    for p in paths:
                        res = extract_direct_json(p, schedule_type, dynamic_timeout)
                        if res and res['schedule_data']: 
                            all_d.extend(res['schedule_data'])
                            all_raw.extend(res['raw_data'])
                            all_raw_json_texts.append(res['raw_json_text'])
                        if p != t_path: os.unlink(p)
                    # 添加诊断信息
                    result_item = {
                        'filename': file.filename, 
                        'success': True, 
                        'schedule_data': all_d,
                        'raw_data': all_raw,
                        'raw_json_text': '\n\n'.join(all_raw_json_texts) if all_raw_json_texts else '',
                        'diagnostics': {
                            'has_raw_data': len(all_raw) > 0,
                            'raw_data_count': len(all_raw),
                            'has_raw_json': len(all_raw_json_texts) > 0,
                            'raw_json_count': len(all_raw_json_texts),
                            'image_count': len(paths),
                            'image_sliced': False,  # 不再进行图片切片
                            'processing_time_estimate': '正常' if len(all_d) > 0 else '快速完成但无数据'
                        }
                    }
                    
                    # 如果最终数据为空，记录警告日志
                    if len(all_d) == 0:
                        logger.warning(f"文件 {file.filename} OCR处理完成但未提取到课程数据。诊断信息: {result_item['diagnostics']}")
                        if len(all_raw) > 0:
                            logger.warning(f"文件 {file.filename} 原始数据存在但被过滤: {len(all_raw)}条记录")
                        else:
                            logger.warning(f"文件 {file.filename} AI识别返回空数据，可能图片无法识别")
                    
                    results.append(result_item)
            except Exception as e:
                results.append({'filename': file.filename, 'success': False, 'error': str(e)})
            finally:
                os.unlink(t_path)
        return jsonify({'success': True, 'results': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==========================================
# 评分系统 Excel 导入导出
# ==========================================

@app.route('/api/parse/scoring-template', methods=['POST'])
def parse_scoring_template():
    """解析评分模板 Excel，AI 识别结构"""
    try:
        file = request.files.get('file')
        if not file:
            return jsonify({'success': False, 'error': '未上传文件'}), 400

        # 保存到临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name

        try:
            result = parse_excel_for_template(tmp_path)
            return jsonify({'success': True, 'data': result})
        finally:
            import os
            os.unlink(tmp_path)

    except Exception as e:
        logger.error(f"评分模板解析失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/parse/contestants', methods=['POST'])
def parse_contestants():
    """解析选手名单 Excel，AI 识别结构"""
    try:
        file = request.files.get('file')
        if not file:
            return jsonify({'success': False, 'error': '未上传文件'}), 400

        # 保存到临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name

        try:
            result = parse_excel_for_contestants(tmp_path)
            return jsonify({'success': True, 'data': result})
        finally:
            import os
            os.unlink(tmp_path)

    except Exception as e:
        logger.error(f"选手名单解析失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/export/scoring-results', methods=['POST'])
def export_scoring_results():
    """读取用户上传的 Excel 模板，AI 分析格式后填充结果并返回"""
    try:
        template_file = request.files.get('template_file')
        # result_data 通过 multipart form 字段发送，是 JSON 字符串
        result_json_str = request.form.get('result_data')

        if not template_file:
            return jsonify({'success': False, 'error': '未上传模板文件'}), 400
        if not result_json_str:
            return jsonify({'success': False, 'error': '未提供结果数据'}), 400

        # 保存模板到临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
            template_file.save(tmp.name)
            tmp_path = tmp.name

        try:
            import json
            result_data = json.loads(result_json_str)

            # 填充结果
            file_bytes = fill_template_with_results(tmp_path, result_data)

            from flask import Response
            return Response(
                file_bytes,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                headers={
                    'Content-Disposition': 'attachment; filename=scoring_results.xlsx',
                    'Content-Length': str(len(file_bytes))
                }
            )

        finally:
            import os
            os.unlink(tmp_path)

    except Exception as e:
        logger.error(f"评分结果导出失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# Gunicorn 入口点（生产环境使用）
def create_app():
    """创建 Flask 应用，供 Gunicorn 调用"""
    return app

if __name__ == '__main__':
    # 开发环境直接运行（单进程单线程）
    # 生产环境应使用: gunicorn -c gunicorn.conf.py app:app
    app.run(host='0.0.0.0', port=5002, debug=False)

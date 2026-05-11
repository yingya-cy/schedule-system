import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import { testConnection } from "./src/config/database.ts";
import { initializeDatabase } from "./src/config/database-schema.ts";
import { authenticate, requireRole } from "./src/middleware/auth.ts";
import scoringRouter from "./src/routes/scoring/index.ts";
import authRouter from "./src/routes/auth.ts";
import fileCenterRouter from "./src/routes/file-center.ts";
import termsRouter from "./src/routes/terms.ts";
import { registerScheduleRoutes } from "./src/routes/schedule-routes.ts";
import { sendError } from "./src/utils/errorHandler.ts";
import pool from './src/config/database.ts';

dotenv.config();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5002";

async function startServer() {
  const app = express();
  const PORT = 3001;
  app.use(express.json({ limit: '10mb' }));

  // 安全头（开发环境禁用 CSP，否则会阻止 Vite 内联脚本和 HMR WebSocket）
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  }));

  // CORS：仅允许应用自身访问 API
  app.use(cors({
    origin: process.env.APP_URL || 'http://localhost:5173',
    credentials: true,
  }));

  // 全局 API 限流：15 分钟内最多 300 请求
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: '请求过于频繁，请稍后再试' },
  });
  app.use('/api', apiLimiter);

  // 认证接口更严格限流：15 分钟内最多 20 次登录尝试
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: '登录尝试过于频繁，请15分钟后再试' },
  });
  app.use('/api/auth/login', authLimiter);

  // 仅为 JSON API 响应设置 UTF-8 编码，不干预文件下载
  app.use('/api', (req, res, next) => {
    const origSend = res.send.bind(res);
    res.send = function (body: unknown) {
      if (typeof body === 'object' && !Buffer.isBuffer(body)) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      return origSend(body);
    } as typeof res.send;
    next();
  });


  console.log('🔍 Testing database connection...');
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('❌ Database connection failed. Please check your MySQL configuration.');
    console.log('📝 Using environment variables or default localhost configuration');
  }

  console.log('🔧 Initializing database...');
  await initializeDatabase();

  const processOcrRequest = async (endpoint: string, req: any, res: any) => {
    try {
      if (!req.file && (!req.files || (Array.isArray(req.files) && req.files.length === 0))) return res.status(400).json({ error: "No file provided" });

      const formData = new FormData();
      if (req.file) {
        formData.append("file", req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });
      } else if (req.files) {
        req.files.forEach((f: any) => formData.append("files", f.buffer, { filename: f.originalname, contentType: f.mimetype }));
      }

      if (req.body.schedule_type) formData.append("schedule_type", req.body.schedule_type);

      console.log(`📡 Proxying: [Node -> Python] ${endpoint}`);
      const response = await axios.post(`${AI_SERVICE_URL}${endpoint}`, formData, { 
        headers: formData.getHeaders(),
        timeout: 300000 // 5 分钟超时，同步后端
      });
      
      const result = response.data;
      console.log(`🚀 Proxied: [Python -> Node -> Frontend] SUCCESS: ${result.success}, ITEMS: ${result.schedule_data?.length}`);
      res.json(result);
    } catch (error: unknown) {
      console.error(`❌ Proxy Error (${endpoint}):`, (error as Error).message);
      sendError(res, error);
    }
  };

  app.post("/api/ocr/image", upload.single("file"), (req, res) => processOcrRequest("/api/ocr/image", req, res));
  app.post("/api/ocr/pdf", upload.single("file"), (req, res) => processOcrRequest("/api/ocr/pdf", req, res));
  app.post("/api/ocr/batch", upload.array("files", 10), (req, res) => processOcrRequest("/api/ocr/batch", req, res));

  app.post("/api/ocr/horizontal_rules", async (req, res) => {
    try {
      console.log(`📡 Proxying: [Node -> Python] /api/ocr/horizontal_rules`);
      const response = await axios.post(`${AI_SERVICE_URL}/api/ocr/horizontal_rules`, req.body);
      res.json(response.data);
    } catch (error: unknown) {
      console.error(`❌ Proxy Error (/api/ocr/horizontal_rules):`, (error as Error).message);
      sendError(res, error);
    }
  });

  app.get("/api/ocr/health", async (req, res) => {
    try {
      const response = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 5000 });
      res.json(response.data);
    } catch (error) { res.status(500).json({ error: "Service down" }); }
  });
// 重置部门数据接口（仅 admin 可用）
app.get("/api/reset-departments", authenticate, requireRole('admin'), async (req, res) => {
  let connection = null;
  try {
    // 从连接池获取连接
    connection = await pool.getConnection();
    
    // 1. 清空旧的乱码数据
    await connection.query("DELETE FROM departments");
    
    // 2. 插入正确的中文部门数据（后端UTF-8编码，绝对不乱码）
    await connection.query(`
      INSERT INTO departments (name, sort_order) VALUES 
      ('主任团', 1),
      ('网编部', 2),
      ('秘书部', 3),
      ('策划部', 4),
      ('咨询部', 5),
      ('外联部', 6),
      ('宣传部', 7)
    `);
    
    res.json({ 
      success: true, 
      message: "✅ 部门数据已成功重置为正确中文" 
    });
  } catch (error: unknown) {
    console.error("❌ 重置部门数据失败:", error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    });
  } finally {
    // ✅ 必须释放连接，避免连接池泄漏
    if (connection) {
      connection.release();
    }
  }
});
  // Auth required for all schedule/query/export/dashboard endpoints
  app.use('/api/schedules', authenticate);
  app.use('/api/query', authenticate);
  app.use('/api/export', authenticate);
  app.use('/api/dashboard', authenticate);

  // 注册课表/查询/导出/仪表盘路由（共享模块）
  registerScheduleRoutes(app);

  // 用户认证 API
  app.use('/api/auth', authRouter);
  // 评分系统 API
  app.use('/api/scoring', scoringRouter);
  // 文件中心 API
  app.use('/api/file-center', fileCenterRouter);
  app.use('/api/terms', termsRouter);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  
  // ⚡️ 全链路保活加固 ⚡️
  server.timeout = 300000;         // 5 分钟总超时
  server.keepAliveTimeout = 305000; // 略大于总超时，防止竞争风险
  server.headersTimeout = 310000;   // 头部超时也相应调大
}
startServer();
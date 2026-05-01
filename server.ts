import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import dotenv from "dotenv";
import { testConnection, initializeDatabase } from "./src/config/database.ts";
import scheduleService from "./src/services/scheduleService.ts";
import queryService from "./src/services/queryService.ts";
import excelExportService from "./src/services/excelExportService.ts";
import scoringRouter from "./src/routes/scoring.ts";
import pool from './src/config/database.ts';

dotenv.config();

const upload = multer({ storage: multer.memoryStorage() });
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5002";

async function startServer() {
  const app = express();
  const PORT = 3001;
  app.use(express.json({ limit: '10mb' }));

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
    } catch (error: any) {
      console.error(`❌ Proxy Error (${endpoint}):`, error.message);
      res.status(500).json({ error: error.message || "OCR service connection failed" });
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
    } catch (error: any) {
      console.error(`❌ Proxy Error (/api/ocr/horizontal_rules):`, error.message);
      res.status(500).json({ error: error.message || "OCR service connection failed" });
    }
  });

  app.get("/api/ocr/health", async (req, res) => {
    try {
      const response = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 5000 });
      res.json(response.data);
    } catch (error) { res.status(500).json({ error: "Service down" }); }
  });
// ✅ 重置部门数据接口（修复乱码专用）
app.get("/api/reset-departments", async (req, res) => {
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
  } catch (error: any) {
    console.error("❌ 重置部门数据失败:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  } finally {
    // ✅ 必须释放连接，避免连接池泄漏
    if (connection) {
      connection.release();
    }
  }
});
  app.get("/api/departments", async (req, res) => {
    try {
      const departments = await scheduleService.getAllDepartments();
      res.json({ success: true, data: departments });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });



  app.get("/api/schedules", async (req, res) => {
    try {
      const { department, name } = req.query;
      const schedules = await scheduleService.getAllSchedules({
        department: department as string,
        name: name as string
      });
      res.json({ success: true, data: schedules });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/schedules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const schedule = await scheduleService.getScheduleWithCourses(id);
      if (!schedule) {
        return res.status(404).json({ success: false, error: "Schedule not found" });
      }
      res.json({ success: true, data: schedule });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/schedules/:id/file", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const download = req.query.download === 'true';
      const fileData = await scheduleService.getScheduleFile(id);
      if (!fileData) {
        return res.status(404).json({ success: false, error: "File not found" });
      }
      
      res.setHeader('Content-Type', fileData.file_type);
      if (download) {
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileData.filename)}"`);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileData.filename)}"`);
      }
      res.send(fileData.file_data);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/schedules", async (req, res) => {
    try {
      const schedule = await scheduleService.createSchedule(req.body);
      res.json({ success: true, data: schedule });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.put("/api/schedules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const schedule = await scheduleService.updateSchedule(id, req.body);
      if (!schedule) {
        return res.status(404).json({ success: false, error: "Schedule not found" });
      }
      res.json({ success: true, data: schedule });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/schedules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await scheduleService.deleteSchedule(id);
      res.json({ success: true, deleted });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/schedules/:scheduleId/courses", async (req, res) => {
    try {
      const scheduleId = parseInt(req.params.scheduleId);
      const course = await scheduleService.createCourse(scheduleId, req.body);
      res.json({ success: true, data: course });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.put("/api/courses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const course = await scheduleService.updateCourse(id, req.body);
      if (!course) {
        return res.status(404).json({ success: false, error: "Course not found" });
      }
      res.json({ success: true, data: course });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/courses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await scheduleService.deleteCourse(id);
      res.json({ success: true, deleted });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/query/free-time", async (req, res) => {
    try {
      const { week, day, section, department, name } = req.query;
      const results = await queryService.queryFreeTime({
        week: week ? parseInt(week as string) : undefined,
        day: day ? parseInt(day as string) : undefined,
        section: section ? parseInt(section as string) : undefined,
        department: department as string,
        name: name as string
      });
      res.json({ success: true, data: results });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/query/person-schedule", async (req, res) => {
    try {
      const { name } = req.query;
      if (!name) {
        return res.status(400).json({ success: false, error: "Name parameter is required" });
      }
      const result = await queryService.getPersonSchedule(name as string);
      if (!result) {
        return res.status(404).json({ success: false, error: "Person not found" });
      }
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/query/department-stats", async (req, res) => {
    try {
      const { department } = req.query;
      if (!department) {
        return res.status(400).json({ success: false, error: "Department parameter is required" });
      }
      const result = await queryService.getDepartmentStats(department as string);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/query/all-free-time", async (req, res) => {
    try {
      const result = await queryService.getAllFreeTimeData();
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/export/reverse-schedule", async (req, res) => {
    try {
      const data = await queryService.getAllFreeTimeData();
      const excelBuffer = excelExportService.generateReverseScheduleExcel(data);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=reverse-schedule.xlsx');
      res.send(excelBuffer);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/export/person-schedule", async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, error: "Name parameter is required" });
      }
      
      const result = await queryService.getPersonSchedule(name);
      if (!result) {
        return res.status(404).json({ success: false, error: "Person not found" });
      }
      
      const excelBuffer = excelExportService.generatePersonScheduleExcel(name, result.all_courses);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${name}-schedule.xlsx`);
      res.send(excelBuffer);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/export/department-stats", async (req, res) => {
    try {
      const { department } = req.body;
      if (!department) {
        return res.status(400).json({ success: false, error: "Department parameter is required" });
      }
      
      const result = await queryService.getDepartmentStats(department);
      const excelBuffer = excelExportService.generateDepartmentStatsExcel(department, result.schedules);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${department}-stats.xlsx`);
      res.send(excelBuffer);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 评分系统 API
  app.use('/api/scoring', scoringRouter);

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
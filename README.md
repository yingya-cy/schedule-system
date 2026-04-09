# 课表识别与空闲统计系统

一个智能课表识别和空闲时间统计系统，支持PDF/图片上传识别、可视化编辑、空闲时间查询和反课表Excel导出。

## 功能特性

### 已实现功能 ✅

1. **课表识别**
   - 支持PDF和图片格式上传
   - 自动识别课表类型（横版/竖版）
   - 批量文件处理
   - 智能解析课程信息

2. **用户信息管理**
   - 上传后录入姓名和部门
   - 部门预设列表
   - 自动从文件名提取姓名

3. **数据存储**
   - MySQL数据库存储
   - 完整的课表和课程信息
   - 支持CRUD操作

4. **空闲时间查询**
   - 按周/天/节次查询
   - 按部门筛选
   - 按姓名搜索
   - 显示空闲人数和名单

5. **课表管理**
   - 查看所有已上传课表
   - 按部门/姓名筛选
   - 查看课表详情
   - 删除课表

6. **Excel导出**
   - 反课表格式导出
   - 支持周数范围合并
   - 符合指定格式要求

### 待完善功能 🚧

1. **可视化编辑**
   - 课表网格视图
   - 拖拽调整课程
   - 添加/删除/编辑课程
   - 合并/拆分课程

2. **数据备份**
   - 手动备份功能
   - 数据恢复功能

## 技术栈

### 前端
- React 19
- TypeScript
- Tailwind CSS
- Motion (动画)
- Lucide React (图标)

### 后端
- Node.js + Express
- TypeScript
- MySQL2 (数据库)
- Multer (文件上传)
- XLSX (Excel导出)

### 外部服务
- Python OCR服务 (localhost:5002)

## 安装和运行

### 前置要求

1. **Node.js** (v18+)
2. **MySQL** (v8.0+)
3. **Python OCR服务** (需要单独启动)

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd 课表识别与空闲统计系统1
```

2. **安装依赖**
```bash
npm install
```

3. **配置MySQL**

创建数据库并配置连接：

```bash
# 方式1: 使用环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库连接信息

# 方式2: 直接修改代码
# 编辑 src/config/database.ts 中的 dbConfig
```

4. **启动OCR服务**

确保Python OCR服务在 `localhost:5002` 运行

5. **启动开发服务器**
```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动

## 数据库配置

### 环境变量

创建 `.env` 文件：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=schedule_system
```

### 数据库表结构

系统会自动创建以下表：

- `departments` - 部门信息
- `schedules` - 课表信息
- `courses` - 课程记录

## API接口

### 课表管理

```
GET    /api/schedules           # 获取所有课表
GET    /api/schedules/:id       # 获取课表详情
POST   /api/schedules           # 创建课表
PUT    /api/schedules/:id       # 更新课表
DELETE /api/schedules/:id       # 删除课表
```

### 课程管理

```
POST   /api/schedules/:scheduleId/courses  # 添加课程
PUT    /api/courses/:id                # 更新课程
DELETE /api/courses/:id                # 删除课程
```

### 查询接口

```
GET /api/query/free-time          # 查询空闲时间
GET /api/query/person-schedule    # 查询个人课表
GET /api/query/department-stats   # 部门统计
GET /api/query/all-free-time     # 获取所有空闲时间
```

### 导出接口

```
POST /api/export/reverse-schedule    # 导出反课表Excel
POST /api/export/person-schedule     # 导出个人课表Excel
POST /api/export/department-stats    # 导出部门统计Excel
```

## 使用说明

### 1. 上传课表

1. 点击"上传课表"按钮
2. 选择PDF或图片文件
3. 等待识别完成
4. 填写姓名和选择部门
5. 保存课表

### 2. 查询空闲时间

1. 切换到"查询空闲"页面
2. 选择查询条件（周/天/节次/部门/姓名）
3. 点击"查询空闲时间"
4. 查看结果和空闲人员名单
5. 可导出反课表Excel

### 3. 管理课表

1. 切换到"课表管理"页面
2. 查看所有已上传课表
3. 使用筛选功能查找特定课表
4. 查看详情或删除课表

## 反课表Excel格式

导出的Excel文件遵循以下格式：

### 基本格式
- 节数写在周数之前
- 使用"/"分隔不同时间段
- 同一节课的空周数聚合显示

### 示例

```
正常情况: 5(1-16)/(17-18)
单双周: 5(1-16)/6双(1-16)/(17-18)
隔周情况: 4(1-2)(5-12)/(3-4)(13-18)
```

## 开发说明

### 项目结构

```
src/
├── components/          # React组件
│   ├── UserInfoDialog.tsx
│   ├── QueryPanel.tsx
│   ├── ScheduleManagement.tsx
│   └── ScheduleEditor.tsx
├── config/             # 配置文件
│   └── database.ts
├── services/           # 业务逻辑
│   ├── scheduleService.ts
│   ├── queryService.ts
│   └── excelExportService.ts
├── types/              # TypeScript类型
│   └── database.ts
├── utils/              # 工具函数
│   ├── pdfParser.ts
│   ├── formatters.ts
│   └── dataMappers.ts
└── App.tsx            # 主应用组件
```

### 代码规范

- 使用TypeScript严格模式
- 遵循React Hooks最佳实践
- 组件使用函数式组件
- 使用Tailwind CSS进行样式设计

## 故障排除

### 数据库连接失败

1. 检查MySQL服务是否运行
2. 验证连接配置是否正确
3. 确保数据库用户有足够权限

### OCR服务不可用

1. 确认Python OCR服务在localhost:5002运行
2. 检查防火墙设置
3. 查看OCR服务日志

### 文件上传失败

1. 检查文件大小限制
2. 确认文件格式支持
3. 查看服务器日志

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 联系方式

如有问题，请联系项目维护者。

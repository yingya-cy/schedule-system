import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../helpers/testServer.ts';

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  app = createApp();
});

describe('GET /api/departments', () => {
  it('returns department list', async () => {
    const res = await supertest(app)
      .get('/api/departments')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(7);
  });
});

describe('Schedule CRUD', () => {
  let scheduleId: number;

  it('POST /api/schedules creates a schedule', async () => {
    const res = await supertest(app)
      .post('/api/schedules')
      .send({ name: '测试课表', department: '网编部', courses: [] })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('测试课表');
    scheduleId = res.body.data.id;
  });

  it('GET /api/schedules lists schedules', async () => {
    const res = await supertest(app)
      .get('/api/schedules')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/schedules?department= filters schedules', async () => {
    const res = await supertest(app)
      .get('/api/schedules?department=网编部')
      .expect(200);

    expect(res.body.data.every((s: any) => s.department === '网编部')).toBe(true);
  });

  it('GET /api/schedules/:id returns schedule with courses', async () => {
    const res = await supertest(app)
      .get(`/api/schedules/${scheduleId}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('测试课表');
  });

  it('PUT /api/schedules/:id updates a schedule', async () => {
    const res = await supertest(app)
      .put(`/api/schedules/${scheduleId}`)
      .send({ name: '更新后的课表' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('更新后的课表');
  });

  it('DELETE /api/schedules/:id deletes a schedule', async () => {
    const res = await supertest(app)
      .delete(`/api/schedules/${scheduleId}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('returns 404 for non-existent schedule', async () => {
    const res = await supertest(app)
      .get(`/api/schedules/${scheduleId}`)
      .expect(404);
    expect(res.body.success).toBe(false);
  });
});

describe('Course CRUD', () => {
  let scheduleId: number;
  let courseId: number;

  beforeAll(async () => {
    const res = await supertest(app)
      .post('/api/schedules')
      .send({ name: '课程测试课表', department: '秘书部', courses: [] });
    scheduleId = res.body.data.id;
  });

  it('POST /api/schedules/:id/courses creates a course', async () => {
    const res = await supertest(app)
      .post(`/api/schedules/${scheduleId}/courses`)
      .send({
        course_name: '高等数学',
        weekday: 1,
        sections: [1, 2],
        weeks: [1, 2, 3, 4],
        teacher: '李教授',
        location: '教学楼A101',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.course_name).toBe('高等数学');
    courseId = res.body.data.id;
  });

  it('PUT /api/courses/:id updates a course', async () => {
    const res = await supertest(app)
      .put(`/api/courses/${courseId}`)
      .send({ teacher: '王教授' })
      .expect(200);

    expect(res.body.data.teacher).toBe('王教授');
  });

  it('DELETE /api/courses/:id deletes a course', async () => {
    const res = await supertest(app)
      .delete(`/api/courses/${courseId}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  afterAll(async () => {
    await supertest(app).delete(`/api/schedules/${scheduleId}`);
  });
});

describe('Dashboard and Contacts', () => {
  it('GET /api/dashboard/stats returns counts', async () => {
    const res = await supertest(app)
      .get('/api/dashboard/stats')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.schedules).toBeDefined();
    expect(res.body.data.users).toBeDefined();
  });

  it('GET /api/courses returns courses list', async () => {
    const res = await supertest(app)
      .get('/api/courses')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/contacts returns user list', async () => {
    const res = await supertest(app)
      .get('/api/contacts')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('Export and File endpoints', () => {
  let scheduleId: number;
  let courseId: number;

  beforeAll(async () => {
    const sRes = await supertest(app)
      .post('/api/schedules')
      .send({ name: '导出测试课表', department: '网编部', courses: [] });
    scheduleId = sRes.body.data.id;

    const cRes = await supertest(app)
      .post(`/api/schedules/${scheduleId}/courses`)
      .send({ course_name: '测试课程', weekday: 1, sections: [1, 2], weeks: [1, 2, 3] });
    courseId = cRes.body.data.id;
  });

  it('GET /api/query/free-time returns results', async () => {
    const res = await supertest(app)
      .get('/api/query/free-time?week=1&day=1&section=1')
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/query/person-schedule requires name param', async () => {
    await supertest(app)
      .get('/api/query/person-schedule')
      .expect(400);
  });

  it('GET /api/query/department-stats requires department param', async () => {
    await supertest(app)
      .get('/api/query/department-stats')
      .expect(400);
  });

  it('POST /api/export/reverse-schedule returns xlsx', async () => {
    const res = await supertest(app)
      .post('/api/export/reverse-schedule')
      .send({})
      .expect(200);
    expect(res.headers['content-type']).toContain('spreadsheet');
  });

  it('POST /api/export/person-schedule requires name', async () => {
    await supertest(app)
      .post('/api/export/person-schedule')
      .send({})
      .expect(400);
  });

  it('POST /api/export/department-stats requires department', async () => {
    await supertest(app)
      .post('/api/export/department-stats')
      .send({})
      .expect(400);
  });

  it('GET /api/schedules/:id/files returns empty array for new schedule', async () => {
    const res = await supertest(app)
      .get(`/api/schedules/${scheduleId}/files`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/schedules/:id/file returns 404 for no file', async () => {
    await supertest(app)
      .get(`/api/schedules/${scheduleId}/file`)
      .expect(404);
  });

  afterAll(async () => {
    await supertest(app).delete(`/api/schedules/${scheduleId}`);
  });
});

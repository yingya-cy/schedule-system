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

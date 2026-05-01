import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../helpers/testServer.ts';

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  app = createApp();
});

describe('Free Time Query', () => {
  it('GET /api/query/free-time returns results', async () => {
    const res = await supertest(app)
      .get('/api/query/free-time')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/query/free-time?department= filters by department', async () => {
    const res = await supertest(app)
      .get('/api/query/free-time?department=网编部')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('Person Schedule', () => {
  it('GET /api/query/person-schedule returns 400 without name', async () => {
    const res = await supertest(app)
      .get('/api/query/person-schedule')
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('GET /api/query/person-schedule?name= returns 404 for unknown', async () => {
    const res = await supertest(app)
      .get('/api/query/person-schedule?name=不存在的人')
      .expect(404);

    expect(res.body.success).toBe(false);
  });
});

describe('Department Stats', () => {
  it('GET /api/query/department-stats returns 400 without department', async () => {
    const res = await supertest(app)
      .get('/api/query/department-stats')
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('GET /api/query/department-stats?department= returns stats', async () => {
    const res = await supertest(app)
      .get('/api/query/department-stats?department=网编部')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('schedules');
  });
});

describe('All Free Time', () => {
  it('GET /api/query/all-free-time returns aggregated data', async () => {
    const res = await supertest(app)
      .get('/api/query/all-free-time')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('total_schedules');
    expect(res.body.data).toHaveProperty('free_time_matrix');
  });
});

describe('Contacts', () => {
  it('GET /api/contacts returns users', async () => {
    const res = await supertest(app)
      .get('/api/contacts')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('Dashboard Stats', () => {
  it('GET /api/dashboard/stats returns counts', async () => {
    const res = await supertest(app)
      .get('/api/dashboard/stats')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('schedules');
    expect(res.body.data).toHaveProperty('courses');
    expect(res.body.data).toHaveProperty('users');
    expect(res.body.data).toHaveProperty('departments');
    expect(res.body.data).toHaveProperty('files');
  });
});

describe('Export', () => {
  it('POST /api/export/reverse-schedule returns xlsx', async () => {
    const res = await supertest(app)
      .post('/api/export/reverse-schedule')
      .expect(200);

    expect(res.headers['content-type']).toContain('spreadsheetml');
  });
});

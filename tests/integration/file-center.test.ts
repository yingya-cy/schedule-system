import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp, loginAs } from '../helpers/testServer.ts';

let app: ReturnType<typeof createApp>;
let token: string;

beforeAll(async () => {
  app = createApp();
  const result = await loginAs(app, 'admin', 'admin123');
  token = result.token;
});

describe('Activities CRUD', () => {
  let activityId: number;

  it('POST /api/file-center/activities creates an activity', async () => {
    const res = await supertest(app)
      .post('/api/file-center/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '测试活动', department: '网编部' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeGreaterThan(0);
    activityId = res.body.data.id;
  });

  it('GET /api/file-center/activities lists activities', async () => {
    const res = await supertest(app)
      .get('/api/file-center/activities')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/file-center/activities/:id returns activity', async () => {
    const res = await supertest(app)
      .get(`/api/file-center/activities/${activityId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.name).toBe('测试活动');
  });

  it('PUT /api/file-center/activities/:id updates activity', async () => {
    const res = await supertest(app)
      .put(`/api/file-center/activities/${activityId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '更新活动名' })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('DELETE /api/file-center/activities/:id deletes activity', async () => {
    const res = await supertest(app)
      .delete(`/api/file-center/activities/${activityId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('returns 401 without auth token', async () => {
    const res = await supertest(app)
      .get('/api/file-center/activities')
      .expect(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Folders and Items', () => {
  let activityId: number;
  let folderId: number;

  beforeAll(async () => {
    const res = await supertest(app)
      .post('/api/file-center/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '文件测试活动', department: '秘书部' });
    activityId = res.body.data.id;
  });

  it('POST /api/file-center/activities/:id/folders creates folder', async () => {
    const res = await supertest(app)
      .post(`/api/file-center/activities/${activityId}/folders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '测试文件夹' })
      .expect(200);

    expect(res.body.success).toBe(true);
    folderId = res.body.data.id;
  });

  it('GET /api/file-center/activities/:id/folders lists folder tree', async () => {
    const res = await supertest(app)
      .get(`/api/file-center/activities/${activityId}/folders`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/file-center/folders/:id/items returns items', async () => {
    const res = await supertest(app)
      .get(`/api/file-center/folders/${folderId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('POST /api/file-center/folders/:id/items creates file item', async () => {
    const res = await supertest(app)
      .post(`/api/file-center/folders/${folderId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ activity_id: activityId, original_filename: 'test.pdf' })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  afterAll(async () => {
    await supertest(app)
      .delete(`/api/file-center/activities/${activityId}`)
      .set('Authorization', `Bearer ${token}`);
  });
});

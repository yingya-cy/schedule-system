import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp, loginAs, createTestUser } from '../helpers/testServer.ts';

let app: ReturnType<typeof createApp>;
let token: string;
let otherToken: string;

beforeAll(async () => {
  app = createApp();
  const result = await loginAs(app, 'admin', 'admin123');
  token = result.token;
  // Create a non-admin user for permission tests
  await createTestUser(app, token, { username: 'fc_tester', name: '测试', password: 'test123', role: 'teacher', department: '网编部' });
  const other = await loginAs(app, 'fc_tester', 'test123');
  otherToken = other.token;
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
  let childFolderId: number;
  let itemId: number;

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

  it('POST /api/file-center/activities/:id/folders creates subfolder', async () => {
    const res = await supertest(app)
      .post(`/api/file-center/activities/${activityId}/folders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '子文件夹', parent_id: folderId })
      .expect(200);

    expect(res.body.success).toBe(true);
    childFolderId = res.body.data.id;
  });

  it('GET /api/file-center/activities/:id/folders lists folder tree', async () => {
    const res = await supertest(app)
      .get(`/api/file-center/activities/${activityId}/folders`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('PUT /api/file-center/folders/:id updates folder', async () => {
    const res = await supertest(app)
      .put(`/api/file-center/folders/${folderId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '改名后' })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('PUT /api/file-center/folders/:id returns 404 for nonexistent', async () => {
    const res = await supertest(app)
      .put('/api/file-center/folders/99999')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'x' })
      .expect(404);

    expect(res.body.success).toBe(false);
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
    itemId = res.body.data.id;
  });

  it('PUT /api/file-center/items/:id updates item', async () => {
    const res = await supertest(app)
      .put(`/api/file-center/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ original_filename: 'renamed.pdf', description: '更新描述' })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('PUT /api/file-center/items/:id returns 404 for nonexistent', async () => {
    const res = await supertest(app)
      .put('/api/file-center/items/99999')
      .set('Authorization', `Bearer ${token}`)
      .send({ original_filename: 'x' })
      .expect(404);

    expect(res.body.success).toBe(false);
  });

  it('DELETE /api/file-center/items/:id deletes item', async () => {
    const res = await supertest(app)
      .delete(`/api/file-center/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  afterAll(async () => {
    await supertest(app)
      .delete(`/api/file-center/activities/${activityId}`)
      .set('Authorization', `Bearer ${token}`);
  });
});

describe('Tweets CRUD', () => {
  let activityId: number;
  let folderId: number;
  let tweetId: number;

  beforeAll(async () => {
    const res = await supertest(app)
      .post('/api/file-center/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '推文测试活动', department: '秘书部' });
    activityId = res.body.data.id;

    const fRes = await supertest(app)
      .post(`/api/file-center/activities/${activityId}/folders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '推文文件夹' });
    folderId = fRes.body.data.id;
  });

  it('POST /api/file-center/folders/:id/tweets creates tweet', async () => {
    const res = await supertest(app)
      .post(`/api/file-center/folders/${folderId}/tweets`)
      .set('Authorization', `Bearer ${token}`)
      .send({ activity_id: activityId, title: '测试推文', summary: '摘要' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeGreaterThan(0);
    tweetId = res.body.data.id;
  });

  it('POST /api/file-center/folders/:id/tweets returns 400 without title', async () => {
    const res = await supertest(app)
      .post(`/api/file-center/folders/${folderId}/tweets`)
      .set('Authorization', `Bearer ${token}`)
      .send({ activity_id: activityId })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('GET /api/file-center/folders/:id/items includes tweets', async () => {
    const res = await supertest(app)
      .get(`/api/file-center/folders/${folderId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.tweets)).toBe(true);
    expect(res.body.data.tweets.length).toBeGreaterThanOrEqual(1);
  });

  it('PUT /api/file-center/tweets/:id updates tweet', async () => {
    const res = await supertest(app)
      .put(`/api/file-center/tweets/${tweetId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '更新的推文', summary: '新摘要' })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('PUT /api/file-center/tweets/:id returns 404 for nonexistent', async () => {
    const res = await supertest(app)
      .put('/api/file-center/tweets/99999')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'x' })
      .expect(404);

    expect(res.body.success).toBe(false);
  });

  it('DELETE /api/file-center/tweets/:id deletes tweet', async () => {
    const res = await supertest(app)
      .delete(`/api/file-center/tweets/${tweetId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('DELETE /api/file-center/tweets/:id returns 404 for already deleted', async () => {
    const res = await supertest(app)
      .delete(`/api/file-center/tweets/${tweetId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(res.body.success).toBe(false);
  });

  afterAll(async () => {
    await supertest(app)
      .delete(`/api/file-center/activities/${activityId}`)
      .set('Authorization', `Bearer ${token}`);
  });
});

describe('Error paths', () => {
  it('POST /api/file-center/activities returns 400 without name', async () => {
    const res = await supertest(app)
      .post('/api/file-center/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({ department: '秘书部' })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('GET /api/file-center/activities/:id returns 404 for nonexistent', async () => {
    const res = await supertest(app)
      .get('/api/file-center/activities/99999')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(res.body.success).toBe(false);
  });

  it('PUT /api/file-center/activities/:id returns 404 for nonexistent', async () => {
    const res = await supertest(app)
      .put('/api/file-center/activities/99999')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'x' })
      .expect(404);

    expect(res.body.success).toBe(false);
  });

  it('DELETE /api/file-center/activities/:id returns 404 for nonexistent', async () => {
    const res = await supertest(app)
      .delete('/api/file-center/activities/99999')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(res.body.success).toBe(false);
  });

  it('POST /api/file-center/activities/:id/folders returns 400 without name', async () => {
    // First create an activity
    const aRes = await supertest(app)
      .post('/api/file-center/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '错误测试活动', department: '秘书部' });
    const aid = aRes.body.data.id;

    const res = await supertest(app)
      .post(`/api/file-center/activities/${aid}/folders`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);

    expect(res.body.success).toBe(false);

    // Cleanup
    await supertest(app)
      .delete(`/api/file-center/activities/${aid}`)
      .set('Authorization', `Bearer ${token}`);
  });

  it('POST /api/file-center/folders/:id/items returns 400 without activity_id', async () => {
    // Create activity and folder
    const aRes = await supertest(app)
      .post('/api/file-center/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '条目错误测试', department: '秘书部' });
    const aid = aRes.body.data.id;
    const fRes = await supertest(app)
      .post(`/api/file-center/activities/${aid}/folders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'test-folder' });
    const fid = fRes.body.data.id;

    const res = await supertest(app)
      .post(`/api/file-center/folders/${fid}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ original_filename: 'no_activity.pdf' })
      .expect(400);

    expect(res.body.success).toBe(false);

    await supertest(app)
      .delete(`/api/file-center/activities/${aid}`)
      .set('Authorization', `Bearer ${token}`);
  });

  it('returns 401 without token for protected endpoints', async () => {
    const endpoints = [
      ['POST', '/api/file-center/activities'],
      ['GET', '/api/file-center/activities'],
      ['POST', '/api/file-center/activities/1/folders'],
    ];
    for (const [method, path] of endpoints) {
      const res = method === 'POST'
        ? await supertest(app).post(path).send({}).expect(401)
        : await supertest(app).get(path).expect(401);
      expect(res.body.success).toBe(false);
    }
  });
});

describe('Permission checks', () => {
  let activityId: number;
  let folderId: number;

  beforeAll(async () => {
    const res = await supertest(app)
      .post('/api/file-center/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '权限测试活动', department: '网编部' });
    activityId = res.body.data.id;

    const fRes = await supertest(app)
      .post(`/api/file-center/activities/${activityId}/folders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '权限文件夹' });
    folderId = fRes.body.data.id;
  });

  it('non-admin cannot edit activity created by admin', async () => {
    const res = await supertest(app)
      .put(`/api/file-center/activities/${activityId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'hacked' })
      .expect(403);

    expect(res.body.success).toBe(false);
  });

  it('non-admin cannot delete activity created by admin', async () => {
    const res = await supertest(app)
      .delete(`/api/file-center/activities/${activityId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);

    expect(res.body.success).toBe(false);
  });

  it('non-admin cannot edit folder created by admin', async () => {
    const res = await supertest(app)
      .put(`/api/file-center/folders/${folderId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'hacked' })
      .expect(403);

    expect(res.body.success).toBe(false);
  });

  afterAll(async () => {
    await supertest(app)
      .delete(`/api/file-center/activities/${activityId}`)
      .set('Authorization', `Bearer ${token}`);
  });
});

describe('OSS endpoints validation', () => {
  it('POST /api/file-center/oss/init returns 400 without required fields', async () => {
    const res = await supertest(app)
      .post('/api/file-center/oss/init')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('activity_id');
  });

  it('POST /api/file-center/oss/init returns 400 without folder_id', async () => {
    const res = await supertest(app)
      .post('/api/file-center/oss/init')
      .set('Authorization', `Bearer ${token}`)
      .send({ activity_id: 1, original_filename: 'test.pdf' })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('POST /api/file-center/oss/presigned-url returns 400 without fields', async () => {
    const res = await supertest(app)
      .post('/api/file-center/oss/presigned-url')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);
    expect(res.body.error).toContain('activity_id');
  });

  it('POST /api/file-center/oss/confirm returns 400 without fields', async () => {
    const res = await supertest(app)
      .post('/api/file-center/oss/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);
    expect(res.body.error).toContain('缺少必要参数');
  });

  it('POST /api/file-center/oss/download-url returns 400 without object_key', async () => {
    const res = await supertest(app)
      .post('/api/file-center/oss/download-url')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);
    expect(res.body.error).toContain('object_key');
  });

  it('GET /api/file-center/oss/download returns 400 without key', async () => {
    const res = await supertest(app)
      .get('/api/file-center/oss/download')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(res.body.error).toContain('key');
  });

  it('GET /api/file-center/oss/preview returns 400 without key', async () => {
    const res = await supertest(app)
      .get('/api/file-center/oss/preview')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(res.body.error).toContain('key');
  });

  it('POST /api/file-center/oss/confirm creates file record without OSS', async () => {
    // First create activity and folder
    const aRes = await supertest(app)
      .post('/api/file-center/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'OSS确认测试', department: '秘书部' });
    const aid = aRes.body.data.id;
    const fRes = await supertest(app)
      .post(`/api/file-center/activities/${aid}/folders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'oss-folder' });
    const fid = fRes.body.data.id;

    const res = await supertest(app)
      .post('/api/file-center/oss/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({
        activity_id: aid,
        folder_id: fid,
        object_key: 'test/key.pdf',
        original_filename: 'confirmed.pdf',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeGreaterThan(0);

    // Cleanup
    await supertest(app)
      .delete(`/api/file-center/activities/${aid}`)
      .set('Authorization', `Bearer ${token}`);
  });
});

describe('Schedule linking', () => {
  let activityId: number;
  let folderId: number;
  let itemId: number;

  beforeAll(async () => {
    const aRes = await supertest(app)
      .post('/api/file-center/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '排期关联测试', department: '秘书部' });
    activityId = aRes.body.data.id;

    const fRes = await supertest(app)
      .post(`/api/file-center/activities/${activityId}/folders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '排期文件夹' });
    folderId = fRes.body.data.id;

    const iRes = await supertest(app)
      .post(`/api/file-center/folders/${folderId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ activity_id: activityId, original_filename: 'link-test.pdf' });
    itemId = iRes.body.data.id;
  });

  it('PUT /api/file-center/items/:id/schedule links schedule', async () => {
    const res = await supertest(app)
      .put(`/api/file-center/items/${itemId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ schedule_id: 1 })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('PUT /api/file-center/items/:id/schedule returns 404 for nonexistent', async () => {
    const res = await supertest(app)
      .put('/api/file-center/items/99999/schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ schedule_id: null })
      .expect(404);

    expect(res.body.success).toBe(false);
  });

  afterAll(async () => {
    await supertest(app)
      .delete(`/api/file-center/activities/${activityId}`)
      .set('Authorization', `Bearer ${token}`);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createAppWithAuth, loginAs, createTestUser } from '../../helpers/testServer';

describe('File Center Permissions', () => {
  let app: ReturnType<typeof createAppWithAuth>;
  let adminToken: string;
  let teacherWebToken: string;
  let teacherSecToken: string;

  let activityId: number;
  let folderId: number;
  let itemId: number;
  let tweetId: number;

  beforeAll(async () => {
    app = createAppWithAuth();
    adminToken = (await loginAs(app, 'admin', 'admin123')).token;

    await createTestUser(app, adminToken, { username: 'fc_tw', name: '网编教师', password: 'test123', role: 'teacher', department: '网编部' });
    await createTestUser(app, adminToken, { username: 'fc_ts', name: '秘书教师', password: 'test123', role: 'teacher', department: '秘书部' });

    teacherWebToken = (await loginAs(app, 'fc_tw', 'test123')).token;
    teacherSecToken = (await loginAs(app, 'fc_ts', 'test123')).token;

    const authWeb = (req: supertest.Test) => req.set('Authorization', `Bearer ${teacherWebToken}`);

    const aRes = await authWeb(supertest(app).post('/api/file-center/activities').send({ name: '权限测试活动', department: '网编部' }));
    activityId = aRes.body.data.id;

    const fRes = await authWeb(supertest(app).post(`/api/file-center/activities/${activityId}/folders`).send({ name: '权限测试文件夹' }));
    folderId = fRes.body.data.id;

    const iRes = await authWeb(supertest(app).post(`/api/file-center/folders/${folderId}/items`).send({ activity_id: activityId, original_filename: 'test.pdf' }));
    itemId = iRes.body.data.id;

    const tRes = await authWeb(supertest(app).post(`/api/file-center/folders/${folderId}/tweets`).send({ activity_id: activityId, title: '测试推文', content: 'test' }));
    tweetId = tRes.body.data.id;
  });

  afterAll(async () => {
    const auth = (req: supertest.Test) => req.set('Authorization', `Bearer ${adminToken}`);
    if (itemId) await auth(supertest(app).delete(`/api/file-center/items/${itemId}`));
    if (tweetId) await auth(supertest(app).delete(`/api/file-center/tweets/${tweetId}`));
    if (folderId) await auth(supertest(app).delete(`/api/file-center/folders/${folderId}`));
    if (activityId) await auth(supertest(app).delete(`/api/file-center/activities/${activityId}`));
  });

  // ---- 401 ----
  describe('Authentication (401)', () => {
    it('should return 401 for GET activities without token', async () => {
      await supertest(app).get('/api/file-center/activities').expect(401);
    });
    it('should return 401 for POST activity without token', async () => {
      await supertest(app).post('/api/file-center/activities').send({ name: 'x', department: 'x' }).expect(401);
    });
  });

  // ---- canModify: Activities ----
  describe('canModify: Activities PUT/DELETE', () => {
    it('should return 403 when non-creator non-admin tries to PUT activity', async () => {
      await supertest(app)
        .put(`/api/file-center/activities/${activityId}`)
        .set('Authorization', `Bearer ${teacherSecToken}`)
        .send({ name: 'hacked' })
        .expect(403);
    });

    it('should return 403 when non-creator non-admin tries to DELETE activity', async () => {
      await supertest(app)
        .delete(`/api/file-center/activities/${activityId}`)
        .set('Authorization', `Bearer ${teacherSecToken}`)
        .expect(403);
    });

    it('should allow creator to PUT their own activity', async () => {
      await supertest(app)
        .put(`/api/file-center/activities/${activityId}`)
        .set('Authorization', `Bearer ${teacherWebToken}`)
        .send({ name: 'creator updated' })
        .expect(200);
    });

    it('should allow admin to PUT any activity', async () => {
      await supertest(app)
        .put(`/api/file-center/activities/${activityId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'admin updated' })
        .expect(200);
    });
  });

  // ---- canModify: Folders ----
  describe('canModify: Folders PUT/DELETE', () => {
    it('should return 403 when non-creator non-admin tries to PUT folder', async () => {
      await supertest(app)
        .put(`/api/file-center/folders/${folderId}`)
        .set('Authorization', `Bearer ${teacherSecToken}`)
        .send({ name: 'hacked' })
        .expect(403);
    });

    it('should return 403 when non-creator non-admin tries to DELETE folder', async () => {
      await supertest(app)
        .delete(`/api/file-center/folders/${folderId}`)
        .set('Authorization', `Bearer ${teacherSecToken}`)
        .expect(403);
    });

    it('should allow creator to PUT their own folder', async () => {
      await supertest(app)
        .put(`/api/file-center/folders/${folderId}`)
        .set('Authorization', `Bearer ${teacherWebToken}`)
        .send({ name: 'folder updated' })
        .expect(200);
    });

    it('should allow admin to PUT any folder', async () => {
      await supertest(app)
        .put(`/api/file-center/folders/${folderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'admin updated folder' })
        .expect(200);
    });
  });

  // ---- canModify: Items ----
  describe('canModify: Items PUT/DELETE', () => {
    it('should return 403 when non-creator non-admin tries to PUT item', async () => {
      await supertest(app)
        .put(`/api/file-center/items/${itemId}`)
        .set('Authorization', `Bearer ${teacherSecToken}`)
        .send({ original_filename: 'hacked.pdf' })
        .expect(403);
    });

    it('should return 403 when non-creator non-admin tries to DELETE item', async () => {
      await supertest(app)
        .delete(`/api/file-center/items/${itemId}`)
        .set('Authorization', `Bearer ${teacherSecToken}`)
        .expect(403);
    });

    it('should allow creator to PUT their own item', async () => {
      await supertest(app)
        .put(`/api/file-center/items/${itemId}`)
        .set('Authorization', `Bearer ${teacherWebToken}`)
        .send({ original_filename: 'updated.pdf' })
        .expect(200);
    });

    it('should allow admin to DELETE item', async () => {
      // Create temp item for admin to delete
      const res = await supertest(app)
        .post(`/api/file-center/folders/${folderId}/items`)
        .set('Authorization', `Bearer ${teacherWebToken}`)
        .send({ activity_id: activityId, original_filename: 'tmp.pdf' });
      await supertest(app)
        .delete(`/api/file-center/items/${res.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  // ---- canModify: Tweets ----
  describe('canModify: Tweets PUT/DELETE', () => {
    it('should return 403 when non-creator non-admin tries to PUT tweet', async () => {
      await supertest(app)
        .put(`/api/file-center/tweets/${tweetId}`)
        .set('Authorization', `Bearer ${teacherSecToken}`)
        .send({ title: 'hacked' })
        .expect(403);
    });

    it('should return 403 when non-creator non-admin tries to DELETE tweet', async () => {
      await supertest(app)
        .delete(`/api/file-center/tweets/${tweetId}`)
        .set('Authorization', `Bearer ${teacherSecToken}`)
        .expect(403);
    });

    it('should allow creator to PUT their own tweet', async () => {
      await supertest(app)
        .put(`/api/file-center/tweets/${tweetId}`)
        .set('Authorization', `Bearer ${teacherWebToken}`)
        .send({ title: 'creator tweet' })
        .expect(200);
    });

    it('should allow admin to DELETE tweet', async () => {
      const res = await supertest(app)
        .post(`/api/file-center/folders/${folderId}/tweets`)
        .set('Authorization', `Bearer ${teacherWebToken}`)
        .send({ activity_id: activityId, title: 'tmp tweet', content: 'x' });
      await supertest(app)
        .delete(`/api/file-center/tweets/${res.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});

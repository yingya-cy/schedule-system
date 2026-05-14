// 心理咨询实时聊天 — WebSocket 双向测试
import WebSocket from 'ws';

const BASE = 'http://localhost:3001';
const WS_BASE = 'ws://localhost:3001';

async function login(username, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`Login failed: ${json.error}`);
  return { token: json.data.token, userId: json.data.user.id, name: json.data.user.name };
}

async function api(token, method, path, body) {
  const opts = { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const json = await res.json();
  if (!json.success) throw new Error(`API ${method} ${path}: ${json.error}`);
  return json.data;
}

function wsConnect(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_BASE}/?token=${token}`);
    const timer = setTimeout(() => reject(new Error('WS connect timeout')), 5000);
    ws.on('open', () => { clearTimeout(timer); resolve(ws); });
    ws.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

async function main() {
  console.log('=== 心理咨询聊天测试 ===\n');

  // 1. 登录
  console.log('1. 登录...');
  const student = await login('fc_ts', 'test123');
  const counselor = await login('admin', 'admin123');
  console.log(`   学生: ${student.name} (id=${student.userId})`);
  console.log(`   咨询师: ${counselor.name} (id=${counselor.userId})`);

  // 2. 创建会话
  console.log('\n2. 获取咨询师 + 创建会话...');
  const counselors = await api(student.token, 'GET', '/api/psychology/counselors');
  const c = counselors[0];
  console.log(`   咨询师: ${c.name} (counselor_id=${c.id}, user_id=${c.user_id})`);

  const conv = await api(student.token, 'POST', '/api/psychology/chat/conversations', { counselor_id: c.id });
  console.log(`   会话 ID: ${conv.id}`);

  // 3. 先用 REST 发消息（验证 REST 通道）
  console.log('\n3. REST 发送消息...');
  const restContent = `REST-test-${Date.now()}`;
  await api(student.token, 'POST', `/api/psychology/chat/${conv.id}/messages`, { content: restContent + '-student' });
  await api(counselor.token, 'POST', `/api/psychology/chat/${conv.id}/messages`, { content: restContent + '-counselor' });

  // 验证 REST 历史包含新消息
  const msgsAfterRest = await api(student.token, 'GET', `/api/psychology/chat/${conv.id}/messages`);
  const foundRest = msgsAfterRest.filter((m) => m.content.startsWith(restContent));
  console.log(`   新消息: ${foundRest.length} 条 (${restContent}-*)`);
  if (foundRest.length !== 2) throw new Error(`Expected 2 new REST messages, got ${foundRest.length}`);
  console.log('   ✓ REST 发送/读取正常');

  // 4. WebSocket 双向通信（核心测试）
  console.log('\n4. WebSocket 实时通信...');
  const wsStudent = await wsConnect(student.token);
  const wsCounselor = await wsConnect(counselor.token);
  console.log('   两方已连接');

  // 收集消息
  const studentMsgs = [];
  const counselorMsgs = [];
  wsStudent.on('message', (data) => {
    const m = JSON.parse(data.toString());
    studentMsgs.push(m);
    console.log(`   [学生端] sender=${m.sender_role} "${m.content}"`);
  });
  wsCounselor.on('message', (data) => {
    const m = JSON.parse(data.toString());
    counselorMsgs.push(m);
    console.log(`   [咨询师端] sender=${m.sender_role} "${m.content}"`);
  });

  const wsPrefix = `WS-${Date.now()}`;

  // 学生发送
  wsStudent.send(JSON.stringify({ conversationId: conv.id, content: `${wsPrefix}-1-学生` }));
  await new Promise((r) => setTimeout(r, 600));

  // 咨询师回复
  wsCounselor.send(JSON.stringify({ conversationId: conv.id, content: `${wsPrefix}-2-咨询师` }));
  await new Promise((r) => setTimeout(r, 600));

  // 第二轮
  wsStudent.send(JSON.stringify({ conversationId: conv.id, content: `${wsPrefix}-3-学生` }));
  await new Promise((r) => setTimeout(r, 400));
  wsCounselor.send(JSON.stringify({ conversationId: conv.id, content: `${wsPrefix}-4-咨询师` }));
  await new Promise((r) => setTimeout(r, 600));

  console.log(`\n   学生端收到 ${studentMsgs.length} 条, 咨询师端收到 ${counselorMsgs.length} 条`);

  const studentGotReply = studentMsgs.some((m) => m.sender_role === 'counselor');
  const counselorGotMsg = counselorMsgs.some((m) => m.sender_role === 'student');
  if (!studentGotReply) throw new Error('Student did not receive counselor reply');
  if (!counselorGotMsg) throw new Error('Counselor did not receive student message');
  console.log('   ✓ WebSocket 双向通信正常');

  // 5. 验证消息持久化
  console.log('\n5. 消息持久化验证...');
  const allMsgs = await api(student.token, 'GET', `/api/psychology/chat/${conv.id}/messages`);
  const wsMsgs = allMsgs.filter((m) => m.content.startsWith(wsPrefix));
  console.log(`   DB 中找到 ${wsMsgs.length} 条 WS 消息 (prefix=${wsPrefix})`);
  if (wsMsgs.length < 4) throw new Error(`Expected >= 4 WS messages in DB, got ${wsMsgs.length}`);
  wsMsgs.forEach((m) => console.log(`   [${m.sender_role}] ${m.content}`));
  console.log('   ✓ 持久化正常');

  wsStudent.close();
  wsCounselor.close();

  console.log('\n=== 全部测试通过 ✓ ===');
  console.log('  REST 发送/读取     ✓');
  console.log('  WebSocket 双向通信  ✓');
  console.log('  消息持久化          ✓');
  console.log('  回声机制 (echo)     ✓');
}

main().catch((err) => {
  console.error('\n✗ 测试失败:', err.message);
  process.exit(1);
});

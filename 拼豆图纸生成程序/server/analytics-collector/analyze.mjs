import fs from 'node:fs';
import path from 'node:path';

const filePath = process.argv[2] || path.join(process.cwd(), 'data', 'events.jsonl');

if (!fs.existsSync(filePath)) {
  console.log(`No data file found: ${filePath}`);
  process.exit(0);
}

const events = fs
  .readFileSync(filePath, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })
  .filter(Boolean);

const eventCounts = {};
const clients = new Set();
const dailyClients = {};
const funnel = {
  image_uploaded: new Set(),
  project_generated: new Set(),
  export: new Set(),
  share_link_copied: new Set(),
};

for (const event of events) {
  eventCounts[event.event] = (eventCounts[event.event] || 0) + 1;
  if (event.clientId) clients.add(event.clientId);

  const day = (event.timestamp || event.receivedAt || '').slice(0, 10);
  if (day) {
    dailyClients[day] = dailyClients[day] || new Set();
    dailyClients[day].add(event.clientId);
  }

  if (funnel[event.event] && event.clientId) {
    funnel[event.event].add(event.clientId);
  }
}

console.log('\n=== 事件统计 ===');
for (const [name, count] of Object.entries(eventCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`${name}: ${count}`);
}

console.log('\n=== 匿名用户 ===');
console.log(`总匿名用户数：${clients.size}`);
console.log('每日活跃匿名用户数：');
for (const day of Object.keys(dailyClients).sort()) {
  console.log(`${day}: ${dailyClients[day].size}`);
}

console.log('\n=== 转化漏斗（按匿名用户） ===');
const uploaded = funnel.image_uploaded.size;
const generated = funnel.project_generated.size;
const exported = funnel.export.size;
const shared = funnel.share_link_copied.size;
console.log(`上传图片：${uploaded}`);
console.log(`生成成功：${generated}`);
console.log(`导出图纸：${exported}`);
console.log(`复制分享链接：${shared}`);

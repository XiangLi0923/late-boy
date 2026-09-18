# 网页版部署与产品测验

## 1. 构建

```powershell
cd frontends\web
npm install
npm run build
```

构建产物在 `frontends/web/dist`。

## 2. 部署

### Netlify

连接 Git 仓库后自动识别 `frontends/web/netlify.toml`，或手动设置：

- Build command: `npm run build`
- Publish directory: `dist`

### Vercel

项目根目录选 `frontends/web`，`vercel.json` 已配置好。

### Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`

部署后，在根目录创建 `.env`（本地开发用 `.env.local`）：

```text
VITE_SHARE_BASE_URL=https://你的实际网址/
```

这样「复制分享链接」会使用你的正式域名。

## 3. 匿名数据与反馈

在 `.env` 或部署平台环境变量中配置：

```text
VITE_ANALYTICS_ENDPOINT=https://你的数据采集端点/
VITE_FEEDBACK_FORM_URL=https://你的问卷地址/
VITE_SURVEY_URL=https://你的问卷地址/
```

- `VITE_ANALYTICS_ENDPOINT`：收到 JSON 事件，例如页面打开、上传图片、
  生成成功、导出、复制分享链接、打开历史、提交反馈。
- `VITE_FEEDBACK_FORM_URL`：反馈弹窗会显示「提交反馈表单」按钮。
- `VITE_SURVEY_URL`：用户首次成功导出图纸后自动打开该问卷，且只打开一次。
- 不配置端点时，事件只保存在当前浏览器 `localStorage`，适合本地调试。
- 所有事件只包含匿名随机 `clientId`，不采集图片和真实身份。

仓库里已经准备好一个零依赖的数据接收服务：

```text
server/analytics-collector/
```

部署后把它的 `/collect` 地址填到 `VITE_ANALYTICS_ENDPOINT` 即可。
分析时运行 `node analyze.mjs data/events.jsonl` 查看事件统计和转化漏斗。

## 4. 产品测验建议

先不要做账号登录，用以下最小闭环测试：

1. 上传图片并生成图纸。
2. 预览、保存 PNG/JSON。
3. 收藏到本地历史。
4. 复制分享链接或二维码。
5. 点击「反馈」提交问题或建议。

重点看这几个指标：

- 首次生成成功率；
- 保存/分享转化率；
- 历史收藏使用率；
- 次日或次周回访率；
- 反馈中提到最多的“缺少功能”。

## 4. 后续决策

- 如果“跨设备同步”需求明显，再做账号和云端历史。
- 如果“分享成品”需求明显，再做作品广场或社交分享。
- 如果用户觉得上传/预览不够顺手，先继续优化主流程，不急于扩展功能。

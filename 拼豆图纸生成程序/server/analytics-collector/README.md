# 匿名事件收集服务

这是一个零依赖的 Node.js 事件接收端，用来接收网页版发来的匿名事件。

## 本地运行

```powershell
node index.mjs
```

默认监听 `http://localhost:8787`，事件写入 `data/events.jsonl`。

## 部署

可以部署到 Render、Railway、Fly.io 或任意 Node.js VPS：

```bash
npm start
```

环境变量：

- `PORT`：端口，默认 `8787`
- `DATA_DIR`：数据目录，默认 `./data`

部署后，网页版配置：

```text
VITE_ANALYTICS_ENDPOINT=https://你的服务地址/collect
```

## 分析数据

```powershell
node analyze.mjs data/events.jsonl
```

会输出事件数量、匿名用户数、每日活跃用户数和基础转化漏斗。

## 隐私说明

- 不记录 IP。
- 不记录图片内容。
- 只记录匿名 `clientId`、事件名、时间戳、页面 URL、浏览器 UA 和必要参数。
- 用户可以通过浏览器清除 `localStorage` 生成新的匿名标识。

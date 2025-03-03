# redis-mcp-transport

基于Redis的传输层，为Model Context Protocol (MCP)提供高效可靠的通信方式，支持服务器发送事件(SSE)。

## 特点
- 基于Redis的可靠消息传递系统
- 支持服务器发送事件(SSE)实时数据流
- 完全实现Model Context Protocol规范
- 适用于分布式LLM应用架构
- 支持水平扩展和高可用性
- 专为Node.js环境优化

## 安装
```
npm install redis-mcp-transport
```

## 基本使用
```
import express from 'express'
import { RedisMcpTransport } from 'redis-mcp-transport';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const REDIS_URL = 'redis://localhost:6379';
const app = express();

// 创建MCP服务器实例
const server = new McpServer({
  name: "ModelService",
  version: "1.0.0",
  handlers: {
    completion: async (params) => {
      // 实现生成文本的逻辑
      return { content: "这是模型生成的回复" };
    }
  }
});

// SSE连接端点
app.get("/stream", async (req, res) => {
  const sessionId = req.query.sessionId || Date.now().toString();
  const transport = new RedisMcpTransport(
    '/api',
    res,
    REDIS_URL
  );
  
  await server.connect(transport);
});

// API请求处理端点
app.post("/api", express.json(), async (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) {
    return res.status(400).send('缺少sessionId参数');
  }
  
  const transport = new RedisMcpTransport(
    '/api',
    sessionId,
    REDIS_URL
  );
  
  await server.connect(transport);
  await transport.handlePostMessage(req, res);
});

app.listen(8000, () => {
  console.log('MCP服务器运行在 http://localhost:8000');
});```

## 贡献
欢迎贡献！请随时提交 Pull Request 或创建 Issue 讨论新功能或报告问题。

## 许可
MIT
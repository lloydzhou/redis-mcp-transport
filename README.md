# redis-mcp-transport

基于Redis的传输层，为Model Context Protocol (MCP)提供高效可靠的通信方式，支持服务器发送事件(SSE)。
专为支持多用户设计，使单个MCP服务器能够同时处理多个并发会话，实现更高效的资源利用。

## 特点
- **多会话支持** - 通过Redis消息系统支持单个服务器同时处理多个用户会话
- 基于Redis的可靠消息传递系统，实现会话状态同步与持久化
- 支持服务器发送事件(SSE)实时数据流
- 完全实现Model Context Protocol规范
- 适用于分布式LLM应用架构，支持横向扩展
- 支持水平扩展和高可用性
- 专为Node.js环境优化

## 安装
```
npm install redis-mcp-transport
```

## 多会话工作原理
Redis-MCP-Transport 通过Redis作为消息中间件，使单个MCP服务器能够同时处理多个用户会话。每个会话都有唯一的会话ID，通过Redis频道进行消息路由，确保消息能准确发送到对应的用户。

此架构特别适合:
- 高流量AI应用需要同时服务多个用户
- 需要扩展模型服务能力的系统架构
- 需要会话状态持久化的应用场景

```
import express from 'express'
import { RedisMcpTransport } from 'redis-mcp-transport';
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

const REDIS_URL = 'redis://localhost:6379';
const app = express();

// 创建MCP服务器实例
const server = new McpServer({
  name: "EchoService",
  version: "1.0.0",
});

server.resource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  async (uri, { name }) => ({
    contents: [{
      uri: uri.href,
      text: `Hello, ${name}!`
    }]
  })
);

// SSE连接端点 - 为每个用户创建唯一会话
app.get("/stream", async (req, res) => {
  const sessionId = req.query.sessionId || Date.now().toString();
  const transport = new RedisMcpTransport(
    '/api',
    res,
    REDIS_URL
  );
  
  await server.connect(transport);
});

// API请求处理端点 - 处理指定会话的请求
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
  res.end();  // 这里需要立即结束，某些客户端会等待超时再结束连接
});

app.listen(8000, () => {
  console.log('MCP服务器运行在 http://localhost:8000');
});
```

## 贡献
欢迎贡献！请随时提交 Pull Request 或创建 Issue 讨论新功能或报告问题。

## 许可
MIT
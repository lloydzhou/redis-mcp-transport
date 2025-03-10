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
  res.end();  // 这里需要立即结束，某些客户端会等待超时再结束连接
});

app.listen(8000, () => {
  console.log('MCP服务器运行在 http://localhost:8000');
});
import { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from 'redis';
import { randomUUID } from "node:crypto";
import contentType from "content-type";
import getRawBody from "raw-body";
import { JSONRPCMessage, JSONRPCMessageSchema } from "@modelcontextprotocol/sdk/types.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport";

// 订阅端实现
export class RedisMcpTransport implements Transport {
  onmessage?: ((message: JSONRPCMessage) => void) | undefined; 
  onerror?: ((error: Error) => void) | undefined;
  _endpoint: string;
  _redisClient: any;
  _isStarted: boolean;
  _sseResponse: ServerResponse | undefined;
  _sessionId: string;
  _subscriberClient: any;
  constructor(endpoint: string, resOrSessionId: ServerResponse | string, redisURL: string) {
    this._endpoint = endpoint;
    this._redisClient = createClient({ url: redisURL });
    this._redisClient.on('error', (err: any) => console.error('Redis Client Error', err));
    this._isStarted = false;
    if (typeof resOrSessionId === 'string') {
      this._sessionId = resOrSessionId as string;
    } else {
      this._sseResponse = resOrSessionId as ServerResponse;
      this._sessionId = randomUUID()
    }
  }

  async start(): Promise<any> {
    if (!this._isStarted) {
      await this._redisClient.connect();
      this._isStarted = true;
    }
    if (this._sseResponse) {
      // 创建单独的订阅客户端
      // 订阅客户端直接操作this._ssrResponse不走onmessage逻辑
      this._subscriberClient = this._redisClient.duplicate();
      await this._subscriberClient.connect();
      const channel = this.getChannelName();

      console.debug('Subscribing to channel:', channel);
      await this._subscriberClient.subscribe(channel, (message: string) => {
        try {
          const data = JSON.parse(message);
          this._sseResponse?.write(`event: message\ndata: ${JSON.stringify(data)}\n\n`);
        } catch (error) {
          console.error('Error handling SSE message:', error);
        }
      });
      this._sseResponse.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      this._sseResponse.write(`event: endpoint\ndata: ${encodeURI(this._endpoint)}?sessionId=${this._sessionId}\n\n`);        
    }
  }

  /**
   * 实现与 SSEServerTransport 兼容的 handlePostMessage 方法
   * @param {Object} req - HTTP 请求对象（不使用，保持接口一致）
   * @param {Object} res - HTTP 响应对象（不使用，保持接口一致）
   * @returns {Promise<void>}
   */
  async handlePostMessage(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // 发布客户端处理handlePostMessage，走onmessage逻辑会触发transport的send方法，始终往redis channel发布消息
    try {
      // @ts-ignore
      let message = req.body;
      if (!message) {
        const contentTypeHeader = req.headers['content-type'];
        const ct = contentType.parse(contentTypeHeader as string);
        if (ct.type !== 'application/json') {
          throw new Error('Unsupported content type');
        }
        let body = await getRawBody(req, { encoding: ct.parameters.charset || 'utf-8' });
        message = JSON.parse(body);
      }
      // const message: any = JSON.parse(body);
      const parsedMessage = JSONRPCMessageSchema.parse(message);
      this.onmessage?.(parsedMessage);
    } catch (error) {
      console.error('Error in handlePostMessage:', error);
      throw error;
    }
  }

  // 走一遍server的onmessage逻辑会触发transport的send方法
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this._isStarted) {
      await this.start();
    }
    const channel = this.getChannelName();
    await this._redisClient.publish(channel, JSON.stringify(message));
    await this.close();
  }

  async close() {
    if (this._subscriberClient) {
      const channel = this.getChannelName();
      await this._subscriberClient.unsubscribe(channel);
      await this._subscriberClient.disconnect();
    }
    if (this._isStarted) {
      await this._redisClient.disconnect();
      this._isStarted = false;
    }
  }

  getSessionId() {
    return this._sessionId;
  }
  getChannelName() {
    return `sse:channel:${this._sessionId}`;
  }
}

export default RedisMcpTransport;

/*!
 * DarkWs websocket library
 * Version: 1.0.6
 * Author: Bobsans (mr.bobsans@gmail.com)
 */

import { isFunction, randomString } from "@/utils";

export interface Events {
  open: [Event],
  close: [Event],
  error: [Event],
  message: [any, Event],
  send: [any]
}

export interface DarkWsOptions {
  canConnect?: () => boolean;
  requestTimeout?: number;
  reconnect?: boolean;
  reconnectTimeout?: number;
  reconnectAttempts?: number;
  pingTimeout?: number;
  debug?: boolean;
}

interface Message {
  id: string;
  data?: any;
  error?: string;
}

export class ErrorResponse<T = any> extends Error {
  public data: T;

  constructor(error: string, data: T) {
    super(error);
    this.data = data;
  }
}

const LOG_PREFIX = "[DarkWs]";

export class DarkWs {
  private interceptors: { [K in keyof Events]: ((...args: Events[K]) => void)[] } = {
    open: [],
    close: [],
    error: [],
    message: [],
    send: []
  };

  private requests: Record<string, { resolve: (value: any) => void, reject: (reason?: any) => void }> = {};
  private socket: WebSocket = null!;
  private _reconnectAttempts = 0;
  private readonly url: string | (() => string);

  private readonly options = {
    canConnect: () => true,
    reconnect: true,
    reconnectTimeout: 5000,
    reconnectAttempts: 20,
    requestTimeout: 1000 * 60 * 5,
    pingTimeout: 1000 * 30,
    debug: false
  } as DarkWsOptions;

  private readonly _closeReasons: Record<number, string> = {
    1000: "Normal closure",
    1001: "Going away",
    1002: "Protocol error",
    1003: "Unsupported data",
    1005: "No status received",
    1006: "Abnormal closure",
    1007: "Invalid frame payload data",
    1008: "Policy violation",
    1009: "Message too big",
    1010: "Mandatory extension",
    1011: "Internal server error",
    1015: "TLS handshake"
  };

  constructor(url: string | (() => string), options: DarkWsOptions = {} as DarkWsOptions) {
    this.url = url;
    this.options = Object.assign(this.options, options);
    this.pingTask();
  }

  public get closing() {
    return !this.socket || this.socket.readyState === WebSocket.CLOSING;
  }

  public get closed() {
    return !this.socket || this.socket.readyState === WebSocket.CLOSED;
  }

  public on<K extends keyof Events>(event: K, callback: (...args: Events[K]) => void) {
    this.interceptors[event].push(callback);
    return () => this.off(event, callback);
  }

  public off<K extends keyof Events>(event: K, callback: (...args: Events[K]) => void) {
    this.interceptors[event].splice(this.interceptors[event].indexOf(callback), 1);
  }

  private getUrl() {
    return isFunction(this.url) ? this.url() : this.url;
  }

  public connect(): DarkWs {
    if (this.options.canConnect && !this.options.canConnect()) {
      setTimeout(() => this.connect(), 100);
      return this;
    }

    this.socket && this.socket.close();
    this.socket = new WebSocket(this.getUrl());

    this.socket.addEventListener("open", (e) => {
      this.debug("Connected to", (e.target as WebSocket).url);
      this.callInterceptors("open", e);
    });

    this.socket.addEventListener("error", (e) => {
      this.debug("Error:", e);
      this.callInterceptors("error", e);
    });

    this.socket.addEventListener("close", (e) => {
      if (e.wasClean) {
        this.debug("Connection closed. [code:", e.code, ", reason:", e.reason, "]");
      } else {
        this.debug("Connection aborted. [code:", e.code, ", reason:", e.reason, "]");
        if (this.options.reconnect && this._reconnectAttempts < this.options.reconnectAttempts!) {
          this.debug(`[${this._reconnectAttempts + 1}] Reconnecting...`);
          setTimeout(() => this.connect(), this.options.reconnectTimeout);
          this._reconnectAttempts++;
        } else {
          this.debug("Connection failed...");
        }
      }

      this.callInterceptors("close", e);
    });

    this.socket.addEventListener("message", (e) => {
      if (e.data === "pong") {
        return;
      }

      this.debug("Data received. [data:", e.data, "]");

      try {
        const {
          id = "@",
          error,
          data
        } = JSON.parse(e.data) as Message;

        if (id === "@") {
          this.callInterceptors("message", data, e);
        } else {
          const resolver = this.requests[id];

          if (resolver) {
            if (error) {
              resolver.reject(new ErrorResponse(error, data));
            } else {
              resolver.resolve(data);
            }

            delete this.requests[id];
          }
        }
      } catch (ex: any) {
        console.warn(LOG_PREFIX, ex instanceof SyntaxError ? "Received invalid JSON." : ex.message);
      }
    });

    return this;
  }

  private waitForConnection() {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          resolve(true);
          clearInterval(interval);
        }
      }, 50);
    });
  }

  private pingTask() {
    setTimeout(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send("ping");
      }
      this.pingTask();
    }, this.options.pingTimeout);
  }

  public async send<T>(data: T) {
    await this.waitForConnection();
    this.socket.send(JSON.stringify(data));
    this.callInterceptors("send", data);
    this.debug("Data sent. [data:", data, "]");
  }

  public request<T>(action: string, payload?: any) {
    return new Promise<T>(async (resolve, reject) => {
      const id = randomString(8);

      await this.send({ id, action, payload });

      if (this.options.requestTimeout) {
        const handle = setTimeout(() => {
          delete this.requests[id];
          reject(new Error("Request cancelled by timeout"));
        }, this.options.requestTimeout);

        this.requests[id] = {
          resolve: (...args) => {
            clearTimeout(handle);
            resolve(...args);
          },
          reject
        };
      } else {
        this.requests[id] = {
          resolve,
          reject
        };
      }
    });
  }

  public close(code = 1000) {
    this.socket.close(code, this._closeReasons[code] ?? "");
  }

  private callInterceptors<K extends keyof Events>(event: K, ...args: Events[K]) {
    for (const handler of this.interceptors[event]) {
      handler(...args);
    }
  }

  private debug(...args: any[]) {
    if (this.options.debug && console && typeof console.debug === "function") {
      console.debug(LOG_PREFIX, ...args);
    }
  }
}

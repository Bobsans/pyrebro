import { DarkWs } from "@/lib/darkws";
import { onBeforeUnmount, onMounted } from "vue";

export const API_SERVER_URL = import.meta.env.API_SERVER_URL;

export interface WebSocketOptions {
  onMessage?: <T>(data: T) => void;
}

let connection: DarkWs | null = null;

export const useWebsocket = (options: WebSocketOptions = {}) => {
  if (!connection) {
    connection = new DarkWs(`${API_SERVER_URL.replace(/^http/g, "ws").replace(/\/$/, "")}/ws`).connect();
  }

  const send = <T>(data: T) => connection!.send(data);
  const request = <T>(action: string, data?: any) => connection!.request<T>(action, data);

  onMounted(() => {
    if (options.onMessage) {
      connection?.on("message", options.onMessage);
    }
  });

  onBeforeUnmount(() => {
    if (options.onMessage) {
      connection?.off("message", options.onMessage);
    }
  });

  return {
    connection,
    send,
    request
  };
};

import type { Entry } from "@/types";

export const API_SERVER_URL = import.meta.env.API_SERVER_URL;

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head" | "options" | "trace" | "connect";

export const useApi = () => {
  const buildUrl = (path: string) => `${API_SERVER_URL.replace(/\/$/g, "")}/${path.replace(/^\//g, "")}`;

  const request = async <T>(method: HttpMethod, path: string, options: RequestInit = {}) => {
    const response = await fetch(buildUrl(path), { ...options, method });
    return {
      response,
      data: await response.json() as T
    };
  };

  const getServers = () => request<string[]>("get", "/servers");
  const getServerInfo = (server: string) => request<string[]>("get", `/server/info?server=${server}`);
  const getDatabases = (server: string) => request<string[]>("get", `/server/databases?server=${server}`);
  const getEntries = (server: string, database: number, pattern: string, sort: string) => request<Entry[]>("get", `/server/entries?server=${server}&database=${database}&pattern=${pattern}&sort=${sort}`);
  const getData = (server: string, database: number, key: string) => request<any>("get", `/server/entry?server=${server}&database=${database}&key=${key}`);
  const deleteKeys = (server: string, database: number, keys: string[]) => request("delete", `/server/entries?server=${server}&database=${database}`, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(keys)
  });

  return {
    request,
    endpoints: {
      getServers,
      getServerInfo,
      getDatabases,
      getEntries,
      getData,
      deleteKeys
    }
  };
};

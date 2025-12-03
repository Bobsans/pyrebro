export type RedisEntry = { key: string, type: string, size: number, ttl: number };
export type RedisEntryData<T = unknown> = { type: string, size: number, data: T };
export type RedisServerInfo = { last_save: string, info: Record<string, Record<string, unknown>> };

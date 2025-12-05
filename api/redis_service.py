import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from redis.asyncio import Redis, RedisError

from config import BASE_PATH, config
from models import RedisEntry, RedisEntryData, RedisServerInfo


class RedisService:
    redis: Redis = None

    @classmethod
    @asynccontextmanager
    async def connect(cls, server: str, database: int = 0) -> AsyncGenerator[Redis]:
        if options := [it for it in config.servers if it.name == server]:
            if cls.redis is None:
                cls.redis = Redis(host=options[0].host, port=options[0].port, db=database, password=options[0].password, decode_responses=True, retry_on_error=[RedisError], retry_on_timeout=True)
            yield cls.redis
        else:
            raise ValueError('Server not found')

    @classmethod
    async def get_databases_count(cls, server: str) -> int:
        async with cls.connect(server) as redis:
            return int((await redis.config_get('databases'))['databases'])

    @classmethod
    async def get_entries(cls, server: str, database: int = 0, pattern: str = '*') -> list[RedisEntry]:
        async with cls.connect(server, database) as redis:
            with open(BASE_PATH / 'scripts' / 'entries.lua') as f:
                values = await redis.eval(f.read(), 1, pattern)
            return [RedisEntry(key=it[0], type=it[1], ttl=int(it[2]), size=int(it[3])) for it in values]

    @classmethod
    async def get_entry_data(cls, server: str, database: int = 0, key: str = '*') -> RedisEntryData:
        async with cls.connect(server, database) as redis:
            value_type = await redis.type(key)

            if value_type == 'string':
                size = await redis.strlen(key)
                return RedisEntryData(type=value_type, data=await redis.get(key), size=size)
            if value_type == 'hash':
                size = await redis.hlen(key)
                return RedisEntryData(type=value_type, data=await redis.hgetall(key), size=size)
            if value_type == 'list':
                size = await redis.llen(key)
                if size > 1000:
                    return RedisEntryData(type=value_type, data=await redis.lrange(key, 0, 999), size=size)
                return RedisEntryData(type=value_type, data=await redis.lrange(key, 0, -1), size=size)
            if value_type == 'set':
                size = await redis.scard(key)
                if size > 1000:
                    return RedisEntryData(type=value_type, data=await redis.srandmember(key, 1000), size=size)
                return RedisEntryData(type=value_type, data=await redis.smembers(key), size=size)
            if value_type == 'zset':
                size = await redis.zcard(key)
                if size > 1000:
                    return RedisEntryData(type=value_type, data=await redis.zrange(key, 0, 999, withscores=True), size=size)
                return RedisEntryData(type=value_type, data=await redis.zrange(key, 0, -1, withscores=True), size=size)
            if value_type == 'stream':
                size = await redis.xlen(key)
                if size > 1000:
                    return RedisEntryData(type=value_type, data=await redis.xrange(key, '-', '+', count=1000), size=size)
                return RedisEntryData(type=value_type, data=await redis.xrange(key, '-', '+'), size=size)
            raise ValueError(f'Unsupported type: {value_type}')

    @classmethod
    async def delete_entries(cls, server: str, database: int, keys: list[str]) -> int:
        async with cls.connect(server, database) as redis:
            return await redis.delete(*keys)

    @classmethod
    async def get_server_info(cls, server: str) -> RedisServerInfo:
        async with cls.connect(server) as redis:
            sections = ['server', 'clients', 'memory', 'persistence', 'threads', 'stats', 'replication', 'cpu', 'commandstats', 'latencystats', 'sentinel', 'cluster', 'modules', 'keyspace', 'errorstats']
            return RedisServerInfo(
                last_save=await redis.lastsave(),
                info=dict(zip(sections, await asyncio.gather(*[redis.info(section) for section in sections])))
            )

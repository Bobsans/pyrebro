import asyncio

from fastapi import FastAPI
from fastapi.params import Body, Query
from redis.asyncio import Redis
from starlette.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocket

from config import BASE_PATH, config

app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/servers")
def get_servers():
    return [it.name for it in config.servers]


@app.get("/server/info")
async def get_server_info(server: str = Query()):
    if options := [it for it in config.servers if it.name == server]:
        redis = Redis(host=options[0].host, port=options[0].port, password=options[0].password)
        sections = ['server', 'clients', 'memory', 'persistence', 'threads', 'stats', 'replication', 'cpu', 'commandstats', 'latencystats', 'sentinel', 'cluster', 'modules', 'keyspace', 'errorstats']
        return {
            'last_save': await redis.lastsave(),
            'info': dict(zip(sections, await asyncio.gather(*[redis.info(section) for section in sections])))
        }
    return {'error': 'Server not found'}


@app.get("/server/databases")
async def get_databases(server: str = Query()):
    if options := [it for it in config.servers if it.name == server]:
        redis = Redis(host=options[0].host, port=options[0].port, password=options[0].password)
        result = await redis.config_get('databases')
        return [i for i in range(int(result['databases']))]
    return {'error': 'Server not found'}


@app.get("/server/entries")
async def get_entries(server: str = Query(), database: int = Query(), pattern: str = Query('*'), sort: str = Query("key:asc")):
    if options := [it for it in config.servers if it.name == server]:
        redis = Redis(host=options[0].host, port=options[0].port, db=database, password=options[0].password)
        with open(BASE_PATH / 'scripts' / 'entries.lua') as f:
            result = await redis.eval(f.read(), 1, pattern)

        sort_field, sort_dir = sort.split(':')

        return sorted([{"key": it[0], "type": it[1], "ttl": it[2], "size": it[3]} for it in result], key=lambda it: it[sort_field], reverse=sort_dir == 'desc')

    return {'error': 'Server not found'}


@app.get("/server/entry")
async def get_entries(server: str = Query(), database: int = Query(), key: str = Query()):
    if options := [it for it in config.servers if it.name == server]:
        redis = Redis(host=options[0].host, port=options[0].port, db=database, password=options[0].password, decode_responses=True)
        type = await redis.type(key)
        if type == 'string':
            return {'type': type, 'value': await redis.get(key)}
        if type == 'hash':
            return {'type': type, 'value': await redis.hgetall(key)}
        if type == 'list':
            if await redis.llen(key) > 1000:
                return {'type': type, 'value': await redis.lrange(key, 0, 999)}
            return {'type': type, 'value': await redis.lrange(key, 0, -1)}
        if type == 'set':
            if await redis.scard(key) > 1000:
                return {'type': type, 'value': await redis.srandmember(key, 1000)}
            return {'type': type, 'value': await redis.smembers(key)}
        if type == 'zset':
            if await redis.zcard(key) > 1000:
                return {'type': type, 'value': await redis.zrange(key, 0, 999, withscores=True)}
            return {'type': type, 'value': await redis.zrange(key, 0, -1, withscores=True)}
        if type == 'stream':
            if await redis.xlen(key) > 1000:
                return {'type': type, 'value': await redis.xrange(key, '-', '+', count=1000)}
            return {'type': type, 'value': await redis.xrange(key, '-', '+')}
        return {'type': type, 'value': None}
    return {'error': 'Server not found'}


@app.delete("/server/entries")
async def get_entries(server: str = Query(), database: int = Query(), keys: list[str] = Body()):
    if options := [it for it in config.servers if it.name == server]:
        redis = Redis(host=options[0].host, port=options[0].port, db=database, password=options[0].password)
        await redis.delete(*keys)
        return True

    return {'error': 'Server not found'}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        await websocket.send_text(f"Message text was: {data}")

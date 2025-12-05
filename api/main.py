import logging
import time

from fastapi import FastAPI
from fastapi.params import Body, Query
from starlette.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocket, WebSocketDisconnect
from websockets import ConnectionClosed

from config import config
from redis_service import RedisService
from utils import dump_json

logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/servers")
def get_servers():
    return [it.name for it in config.servers]


@app.get("/server/info")
async def get_server_info(server: str = Query()):
    try:
        return await RedisService.get_server_info(server)
    except Exception as e:
        logger.exception(e, "Failed to get server info")
        return {'error': str(e)}


@app.get("/server/databases")
async def get_databases(server: str = Query()):
    try:
        count = await RedisService.get_databases_count(server)
        return [i for i in range(count)]
    except Exception as e:
        logger.exception(e, "Failed to get databases")
        return {'error': str(e)}


@app.get("/server/entries")
async def get_entries(server: str = Query(), database: int = Query(), pattern: str = Query('*'), sort: str = Query("key:asc")):
    try:
        entries = await RedisService.get_entries(server, database, pattern)
        sort_field, sort_dir = sort.split(':')
        return sorted(entries, key=lambda it: getattr(it, sort_field), reverse=sort_dir == 'desc')
    except Exception as e:
        logger.exception(e, "Failed to get entries")
        return {'error': str(e)}


@app.get("/server/entry")
async def get_entry(server: str = Query(), database: int = Query(), key: str = Query()):
    try:
        return await RedisService.get_entry_data(server, database, key)
    except Exception as e:
        logger.exception(e, "Failed to get entry")
        return {'error': str(e)}


@app.delete("/server/entries")
async def delete_entries(server: str = Query(), database: int = Query(), keys: list[str] = Body()):
    try:
        await RedisService.delete_entries(server, database, keys)
        return True
    except Exception as e:
        logger.exception(e, "Failed to delete entries")
        return {'error': str(e)}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        try:
            data = await websocket.receive_json()
            await handle_message(websocket, data)
        except (ConnectionClosed, WebSocketDisconnect):
            break
        except Exception as e:
            logger.error(f"Failed to process WS message: {e}")


async def handle_message(websocket: WebSocket, data: dict):
    timestamp = time.time()
    event = "@"

    if isinstance(data, dict):
        event = data['action']
        if data['action'] == 'server:entries':
            result = await get_entries(**data['payload'])
            await websocket.send_text(dump_json({'id': data['id'], 'data': result}))
        elif data['action'] == 'server:entry':
            result = await get_entry(**data['payload'])
            await websocket.send_text(dump_json({'id': data['id'], 'data': result}))
        else:
            await websocket.send_text(dump_json({'id': data['id'], 'error': 'Invalid action'}))
    else:
        await websocket.send_text(dump_json({'error': 'Invalid message format'}))

    logger.info(f"WS {event} [{time.time() - timestamp:.3f}s]")

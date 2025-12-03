from datetime import datetime
from typing import Any

from pydantic import BaseModel


class RedisEntry(BaseModel):
    key: str
    type: str
    size: int
    ttl: int


class RedisEntryData(BaseModel):
    type: str
    data: Any
    size: int


class RedisServerInfo(BaseModel):
    last_save: datetime
    info: dict[str, dict[str, Any]]

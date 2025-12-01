import logging
from pathlib import Path

import yaml
from pydantic import BaseModel

BASE_PATH = Path(__file__).parent


class Config(BaseModel):
    servers: list[Server] = []

    class Server(BaseModel):
        name: str
        host: str
        port: int = 6379
        database: int | None = 0
        password: str | None = None


config = Config()

try:
    with open(BASE_PATH / "config.yaml") as f:
        config = Config.model_validate(yaml.load(f, Loader=yaml.FullLoader))
except FileNotFoundError:
    logging.getLogger(__name__).warning("No config.yaml found. Using default settings.")

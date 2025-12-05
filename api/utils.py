import functools
import json

from pydantic import BaseModel


class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, BaseModel):
            return o.model_dump()
        return o


load_json = functools.partial(json.loads)
dump_json = functools.partial(json.dumps, cls=JSONEncoder)

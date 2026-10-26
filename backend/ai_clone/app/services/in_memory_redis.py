"""In-memory Redis fallback for local dev when Redis server is offline."""

import asyncio
import threading
import time
from typing import Any, Dict, List, Optional


class InMemoryPipeline:
    def __init__(self, store: "InMemoryRedis"):
        self._store = store
        self._ops = []

    def hset(self, name: str, key: str = None, value: str = None, mapping: dict = None):
        self._ops.append(("hset", name, mapping or {key: value}))
        return self

    def expire(self, name: str, time_s: int):
        self._ops.append(("expire", name, time_s))
        return self

    def delete(self, *names: str):
        self._ops.append(("delete", names))
        return self

    def lpush(self, name: str, *values):
        self._ops.append(("lpush", name, values))
        return self

    def execute(self):
        for op in self._ops:
            if op[0] == "hset":
                self._store.hset(op[1], mapping=op[2])
            elif op[0] == "expire":
                pass
            elif op[0] == "delete":
                self._store.delete(*op[1])
            elif op[0] == "lpush":
                self._store.lpush(op[1], *op[2])
        self._ops = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


class InMemoryRedis:
    def __init__(self):
        self._hashes: Dict[str, Dict[str, str]] = {}
        self._lists: Dict[str, List[str]] = {}
        self._lock = threading.Lock()

    def pipeline(self, transaction: bool = True):
        return InMemoryPipeline(self)

    def hset(self, name: str, key: str = None, value: str = None, mapping: dict = None):
        with self._lock:
            if name not in self._hashes:
                self._hashes[name] = {}
            if mapping:
                self._hashes[name].update({str(k): str(v) for k, v in mapping.items()})
            elif key is not None:
                self._hashes[name][str(key)] = str(value)

    def hgetall(self, name: str) -> Dict[str, str]:
        with self._lock:
            return dict(self._hashes.get(name, {}))

    def lpush(self, name: str, *values):
        with self._lock:
            if name not in self._lists:
                self._lists[name] = []
            for v in values:
                self._lists[name].insert(0, str(v))

    def llen(self, name: str) -> int:
        with self._lock:
            return len(self._lists.get(name, []))

    def lpos(self, name: str, value: str) -> Optional[int]:
        with self._lock:
            lst = self._lists.get(name, [])
            try:
                return lst.index(str(value))
            except ValueError:
                return None

    def exists(self, *names: str) -> int:
        with self._lock:
            return sum(1 for name in names if (name in self._hashes or name in self._lists))

    def delete(self, *names: str) -> int:
        with self._lock:
            count = 0
            for name in names:
                if name in self._hashes:
                    del self._hashes[name]
                    count += 1
                if name in self._lists:
                    del self._lists[name]
                    count += 1
            return count

    def blmove(self, first: str, second: str, timeout: int = 0, wherefrom: str = "RIGHT", whereto: str = "LEFT"):
        deadline = time.time() + (timeout if timeout > 0 else 0)
        while True:
            with self._lock:
                lst_from = self._lists.get(first, [])
                if lst_from:
                    val = lst_from.pop() if wherefrom == "RIGHT" else lst_from.pop(0)
                    if second not in self._lists:
                        self._lists[second] = []
                    if whereto == "LEFT":
                        self._lists[second].insert(0, val)
                    else:
                        self._lists[second].append(val)
                    return val
            if timeout <= 0 or time.time() >= deadline:
                return None
            time.sleep(min(0.2, max(0.05, timeout)))

    def lmove(self, first: str, second: str, wherefrom: str = "LEFT", whereto: str = "RIGHT"):
        return self.blmove(first, second, timeout=0, wherefrom=wherefrom, whereto=whereto)

    def lrem(self, name: str, count: int, value: str):
        with self._lock:
            lst = self._lists.get(name, [])
            if str(value) in lst:
                lst.remove(str(value))

    def lrange(self, name: str, start: int, end: int) -> List[str]:
        with self._lock:
            lst = self._lists.get(name, [])
            if end == -1:
                return list(lst[start:])
            return list(lst[start:end + 1])

    def ping(self) -> bool:
        return True

    def close(self):
        pass


class AsyncInMemoryRedis:
    def __init__(self, sync_redis: InMemoryRedis):
        self._sync = sync_redis

    async def ping(self) -> bool:
        return True

    async def aclose(self):
        pass

# app/ws.py
import json, asyncio, time
from typing import Dict, Set, DefaultDict
from collections import defaultdict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

# ✅ Import your existing DiskCache instance
# If you expose `cache = FanoutCache(...)` somewhere, import it here:
# from your_project.cache import cache
from diskcache import FanoutCache
cache = FanoutCache("/tmp/dc-status", shards=8)  # <-- replace with your existing one

router = APIRouter()

# ----------------------------
# Config (tweak to taste)
# ----------------------------
SEND_INTERVAL_S = 1.0        # send at most once per process per second
TAIL_POLL_INTERVAL_S = 0.10  # how often we check the seq counter
MAX_TOPICS_PER_SOCKET = 200  # safety

# ----------------------------
# Key helpers (match your scheme)
# ----------------------------
def _snap_key(proc_id: str) -> str: return f"snap:proc:{proc_id}"
def _seq_key(proc_id: str)  -> str: return f"seq:proc:{proc_id}"
def _log_key(proc_id: str, seq: int) -> str: return f"log:proc:{proc_id}:{seq}"

def read_snapshot(proc_id: str):
    """Return latest snapshot dict or None."""
    return cache.get(_snap_key(proc_id), default=None)

def latest_seq(proc_id: str) -> int:
    return cache.get(_seq_key(proc_id), default=0)

def read_log_range(proc_id: str, start_seq: int, end_seq: int):
    """Yield dict events for seq in [start_seq, end_seq]."""
    for s in range(start_seq, end_seq + 1):
        e = cache.get(_log_key(proc_id, s), default=None)
        if e is not None:
            yield e

# ----------------------------
# WS manager (multiplex topics)
# ----------------------------
class WSManager:
    def __init__(self):
        self.client_topics: DefaultDict[WebSocket, Set[str]] = defaultdict(set)
        self.tasks: DefaultDict[WebSocket, Dict[str, asyncio.Task]] = defaultdict(dict)

    async def connect(self, ws: WebSocket):
        await ws.accept()

    async def disconnect(self, ws: WebSocket):
        for t in list(self.tasks[ws].values()):
            t.cancel()
        self.tasks.pop(ws, None)
        self.client_topics.pop(ws, None)

    async def subscribe(self, ws: WebSocket, topic: str):
        # expect "proc:<process_id>"
        if not topic.startswith("proc:"):
            await self._send(ws, {"type":"error","topic":topic,"code":"bad_topic","message":"use proc:<id>"})
            return
        if len(self.client_topics[ws]) >= MAX_TOPICS_PER_SOCKET:
            await self._send(ws, {"type":"error","topic":topic,"code":"too_many_topics"})
            return

        self.client_topics[ws].add(topic)
        proc_id = topic.split(":", 1)[1]

        # snapshot first (initial paint)
        snap = read_snapshot(proc_id)
        if snap:
            await self._send(ws, {"type":"snapshot","topic":topic,"item":snap})
        else:
            await self._send(ws, {"type":"error","topic":topic,"code":"not_found"})

        # start tail task for this topic if not already running
        if topic not in self.tasks[ws]:
            self.tasks[ws][topic] = asyncio.create_task(self._tail(ws, topic, proc_id))

    async def unsubscribe(self, ws: WebSocket, topic: str):
        self.client_topics[ws].discard(topic)
        t = self.tasks[ws].pop(topic, None)
        if t:
            t.cancel()
            try: await t
            except asyncio.CancelledError: pass

    async def _tail(self, ws: WebSocket, topic: str, proc_id: str):
        last_seq = latest_seq(proc_id)
        last_sent = 0.0
        while topic in self.client_topics[ws]:
            try:
                cur = latest_seq(proc_id)
                now = time.time()
                if cur > last_seq and (now - last_sent) >= SEND_INTERVAL_S:
                    for ev in read_log_range(proc_id, last_seq + 1, cur):
                        await self._send(ws, {"type":"event","topic":topic,"data":ev})
                    last_seq = cur
                    last_sent = now
                await asyncio.sleep(TAIL_POLL_INTERVAL_S)
            except Exception as e:
                await self._send(ws, {"type":"error","topic":topic,"code":"stream_error","message":str(e)})
                await asyncio.sleep(0.5)

    async def _send(self, ws: WebSocket, obj: dict):
        await ws.send_text(json.dumps(obj, separators=(",",":")))

manager = WSManager()

@router.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await manager.connect(ws)
    hb = asyncio.create_task(_heartbeat(ws))
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                await ws.send_text(json.dumps({"type":"error","code":"bad_json"}))
                continue

            t = msg.get("type")
            topics = msg.get("topics") or []
            if t == "subscribe":
                for topic in topics:
                    await manager.subscribe(ws, topic)
            elif t == "unsubscribe":
                for topic in topics:
                    await manager.unsubscribe(ws, topic)
            elif t == "ping":
                await ws.send_text(json.dumps({"type":"pong","t":msg.get("t")}, separators=(",",":")))
            else:
                await ws.send_text(json.dumps({"type":"error","code":"unknown_type"}))
    except WebSocketDisconnect:
        pass
    finally:
        hb.cancel()
        await manager.disconnect(ws)

async def _heartbeat(ws: WebSocket):
    while True:
        await asyncio.sleep(15)
        try:
            await ws.send_text('{"type":"server_heartbeat"}')
        except Exception:
            break










from fastapi import FastAPI
from app.ws import router as ws_router

app = FastAPI()
app.include_router(ws_router)  # exposes /ws






# app/publish.py
import time
from typing import Optional, Dict, Any
from diskcache import FanoutCache
# from your_project.cache import cache
cache = FanoutCache("/tmp/dc-status", shards=8)

LOG_TTL = 24*3600
SNAP_TTL = 3*24*3600
THROTTLE_S = 1.0

def _snap_key(pid): return f"snap:proc:{pid}"
def _seq_key(pid):  return f"seq:proc:{pid}"
def _log_key(pid,s): return f"log:proc:{pid}:{s}"

_last_emit: Dict[str, float] = {}

def publish_status(process_id: str, state: str, progress: int,
                   node_id: Optional[str]=None, job_id: Optional[str]=None,
                   meta: Optional[Dict[str,Any]]=None):
    now = time.time()
    last = _last_emit.get(process_id, 0.0)
    if now - last < THROTTLE_S:
        return None
    _last_emit[process_id] = now

    payload = {
        "process_id": process_id,
        "node_id": node_id,
        "job_id": job_id,
        "state": state,           # "queued" | "running" | "done" | "failed" | "canceled"
        "progress": int(progress),
        "ts": now,
        "meta": meta or {}
    }
    cache.set(_snap_key(process_id), payload, expire=SNAP_TTL)
    seq = cache.incr(_seq_key(process_id), default=0)
    cache.set(_log_key(process_id, seq), payload, expire=LOG_TTL)
    return seq






let ws: WebSocket | null = null;
let connected = false;
let backoff = 500;

const listeners = new Map<string, Set<(msg: any) => void>>(); // topic -> handlers

function wsUrl() {
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${location.host}/ws`;
}

function connect() {
  ws = new WebSocket(wsUrl());

  ws.onopen = () => {
    connected = true;
    backoff = 500;
    const topics = Array.from(listeners.keys());
    if (topics.length) {
      ws!.send(JSON.stringify({ type: "subscribe", topics }));
    }
  };

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    const topic = msg.topic;
    if (topic && listeners.has(topic)) {
      listeners.get(topic)!.forEach(fn => fn(msg));
    }
  };

  ws.onclose = () => {
    connected = false;
    const jitter = 0.9 + Math.random() * 0.2;
    backoff = Math.min(10000, backoff * 1.8);
    setTimeout(connect, backoff * jitter);
  };

  ws.onerror = () => { try { ws?.close(); } catch {} };
}

export function ensureSocket() {
  if (!ws) connect();
}

export function subscribe(topic: string, handler: (msg: any) => void) {
  ensureSocket();
  if (!listeners.has(topic)) listeners.set(topic, new Set());
  listeners.get(topic)!.add(handler);
  if (connected) ws!.send(JSON.stringify({ type: "subscribe", topics: [topic] }));
}

export function unsubscribe(topic: string, handler: (msg: any) => void) {
  const set = listeners.get(topic);
  if (!set) return;
  set.delete(handler);
  if (set.size === 0) {
    listeners.delete(topic);
    if (connected) ws!.send(JSON.stringify({ type: "unsubscribe", topics: [topic] }));
  }
}






import { useEffect, useRef, useState } from "react";
import { subscribe, unsubscribe, ensureSocket } from "../ws/socket";

type State = "queued" | "running" | "done" | "failed" | "canceled";

export interface ProcessSnapshot {
  process_id: string;
  node_id?: string;
  job_id?: string;
  state: State;
  progress: number; // 0..100
  ts: number;
  meta?: Record<string, any>;
}

async function fetchStatusREST(processId: string): Promise<ProcessSnapshot> {
  const res = await fetch(`/process/${processId}/status`);
  if (!res.ok) throw new Error("status fetch failed");
  return res.json();
}

export function useProcessStatus(processId: string, { enableWS = true, fallbackPollMs = 4000 } = {}) {
  const [data, setData] = useState<ProcessSnapshot | null>(null);
  const [live, setLive] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const topic = `proc:${processId}`;

    const onMsg = (msg: any) => {
      if (!mounted) return;
      if (msg.type === "snapshot") { setData(msg.item); setLive(true); }
      else if (msg.type === "event") { setData(msg.data); setLive(true); }
    };

    if (enableWS) {
      ensureSocket();
      subscribe(topic, onMsg);
    }

    // Fallback if WS doesn't land quickly
    (async () => {
      await new Promise(r => setTimeout(r, 1200));
      if (!mounted || live) return;
      try { setData(await fetchStatusREST(processId)); } catch {}
      pollRef.current = window.setInterval(async () => {
        try { const snap = await fetchStatusREST(processId); if (mounted) setData(snap); } catch {}
      }, fallbackPollMs);
    })();

    return () => {
      mounted = false;
      if (enableWS) unsubscribe(topic, onMsg);
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [processId, enableWS]);

  return { data, live }; // live=true means WebSocket is feeding
}







import { useProcessStatus } from "../hooks/useProcessStatus";

export function NodeStatus({ processId }: { processId: string }) {
  const { data, live } = useProcessStatus(processId, { enableWS: true });
  if (!data) return <div>Loading…</div>;
  return (
    <div>
      <div><b>Process:</b> {data.process_id}</div>
      <div><b>State:</b> {data.state} {live ? "• live" : "• fallback"}</div>
      <div><b>Progress:</b> {data.progress}%</div>
    </div>
  );
}




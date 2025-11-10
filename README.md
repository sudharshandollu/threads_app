let ws = null;
let connected = false;
let backoff = 500; // ms
const listeners = new Map(); // topic -> Set(handlers)

function wsUrl(instanceId) {
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  // optional: pass instanceId for auth/diagnostics
  return `${scheme}://${window.location.host}/ws?instance=${encodeURIComponent(instanceId||"")}`;
}

function connect(instanceId) {
  ws = new WebSocket(wsUrl(instanceId));

  ws.onopen = () => {
    connected = true;
    backoff = 500;
    // resubscribe all topics after reconnect
    const topics = Array.from(listeners.keys());
    if (topics.length) {
      ws.send(JSON.stringify({ type: "subscribe", topics }));
    }
  };

  ws.onmessage = (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    const topic = msg.topic;
    if (topic && listeners.has(topic)) {
      listeners.get(topic).forEach(fn => { try { fn(msg); } catch {} });
    }
  };

  ws.onclose = () => {
    connected = false;
    const jitter = 0.9 + Math.random() * 0.2;
    backoff = Math.min(10000, backoff * 1.8);
    setTimeout(() => connect(instanceId), backoff * jitter);
  };

  ws.onerror = () => { try { ws && ws.close(); } catch {} };
}

export function ensureSocket(instanceId) {
  if (!ws) connect(instanceId);
}

export function subscribe(topic, handler) {
  if (!listeners.has(topic)) listeners.set(topic, new Set());
  listeners.get(topic).add(handler);
  if (connected) {
    ws.send(JSON.stringify({ type: "subscribe", topics: [topic] }));
  }
}

export function unsubscribe(topic, handler) {
  const set = listeners.get(topic);
  if (!set) return;
  set.delete(handler);
  if (set.size === 0) {
    listeners.delete(topic);
    if (connected) {
      ws.send(JSON.stringify({ type: "unsubscribe", topics: [topic] }));
    }
  }
}





import { useEffect, useRef, useState } from "react";
import { subscribe, unsubscribe, ensureSocket } from "../ws/socket";

async function fetchStatusREST(processId) {
  const res = await fetch(`/process/${processId}/status`, { cache: "no-store" });
  if (!res.ok) throw new Error("status fetch failed");
  return res.json();
}

/** Live status for one process_id */
export function useProcessStatus(processId, { instanceId, enableWS = true, fallbackPollMs = 4000 } = {}) {
  const [data, setData] = useState(null);
  const [live, setLive] = useState(false); // true if WS delivering
  const pollRef = useRef(null);

  useEffect(() => {
    if (!processId) return;
    let mounted = true;
    const topic = `proc:${processId}`;

    const onMsg = (msg) => {
      if (!mounted) return;
      if (msg.type === "snapshot") { setData(msg.item); setLive(true); }
      else if (msg.type === "event") { setData(msg.data); setLive(true); }
    };

    if (enableWS) {
      // make sure socket exists (tie it to this instance page)
      ensureSocket(instanceId);
      subscribe(topic, onMsg);
    }

    // Fallback if WS doesn't bring data quickly
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
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [processId, instanceId, enableWS, fallbackPollMs, live]);

  return { data, live };
}








import React, { useState, useCallback, useEffect } from "react";
import { ensureSocket } from "../ws/socket";
import { useProcessStatus } from "../hooks/useProcessStatus";

// Example: call your “run node” API and get { process_id }
async function runNode(nodeId, instanceId) {
  const res = await fetch(`/nodes/${encodeURIComponent(nodeId)}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instance_id: instanceId })
  });
  if (!res.ok) throw new Error("run failed");
  return res.json(); // { process_id: "..." }
}

function ProcessCard({ processId, instanceId }) {
  const { data, live } = useProcessStatus(processId, { instanceId, enableWS: true, fallbackPollMs: 5000 });
  if (!data) return <div className="card">Loading…</div>;
  return (
    <div className="card">
      <div><b>Process:</b> {data.process_id}</div>
      <div><b>State:</b> {data.state} {live ? "• live" : "• fallback"}</div>
      <div><b>Progress:</b> {data.progress}%</div>
      {/* render extra fields from data.meta if you have them */}
    </div>
  );
}

export default function InstancePage({ instanceId, initialNodes = [] }) {
  const [processes, setProcesses] = useState([]); // array of process_ids

  // Ensure WS is up as soon as this page appears
  useEffect(() => {
    ensureSocket(instanceId);
  }, [instanceId]);

  const onRunNode = useCallback(async (nodeId) => {
    try {
      const { process_id } = await runNode(nodeId, instanceId);
      setProcesses(prev => prev.includes(process_id) ? prev : [...prev, process_id]);
    } catch (e) {
      console.error("Run node failed", e);
      alert("Failed to start node");
    }
  }, [instanceId]);

  return (
    <div>
      <h2>Instance {instanceId}</h2>

      <div style={{ margin: "12px 0" }}>
        {/* your node UI; example buttons */}
        {initialNodes.map(n => (
          <button key={n.id} onClick={() => onRunNode(n.id)}>
            Run {n.label}
          </button>
        ))}
      </div>

      <div className="grid">
        {processes.map(pid => (
          <ProcessCard key={pid} processId={pid} instanceId={instanceId} />
        ))}
      </div>
    </div>
  );
}








# routers/run.py
from fastapi import APIRouter
import uuid

router = APIRouter(prefix="/nodes", tags=["nodes"])

@router.post("/{node_id}/run")
def run_node(node_id: str, payload: dict):
    instance_id = payload.get("instance_id")
    # create a new process id
    process_id = str(uuid.uuid4())
    # enqueue your work here; immediately write an initial snapshot
    # (queued state) to DiskCache so the WS can snapshot right away.
    # Example:
    # publish_status(process_id, state="queued", progress=0, node_id=node_id, job_id=instance_id)

    return {"process_id": process_id}









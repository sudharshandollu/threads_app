// One resilient WebSocket per tab + topic-based pub/sub (no TypeScript)

let ws = null;
let connected = false;
let backoff = 500; // ms, grows with jittered backoff
const listeners = new Map(); // topic -> Set(handlers)

function wsUrl() {
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.host}/ws`;
}

function connect() {
  ws = new WebSocket(wsUrl());

  ws.onopen = () => {
    connected = true;
    backoff = 500;
    // resubscribe after reconnect
    const topics = Array.from(listeners.keys());
    if (topics.length) {
      ws.send(JSON.stringify({ type: "subscribe", topics }));
    }
  };

  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    const topic = msg.topic;
    if (topic && listeners.has(topic)) {
      listeners.get(topic).forEach(fn => {
        try { fn(msg); } catch {}
      });
    }
  };

  ws.onclose = () => {
    connected = false;
    const jitter = 0.9 + Math.random() * 0.2;
    backoff = Math.min(10000, backoff * 1.8);
    setTimeout(connect, backoff * jitter);
  };

  ws.onerror = () => {
    try { ws && ws.close(); } catch {}
  };
}

export function ensureSocket() {
  if (!ws) connect();
}

export function subscribe(topic, handler) {
  ensureSocket();
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

// REST fallback for when WS isn't available/connected yet
async function fetchStatusREST(processId) {
  const res = await fetch(`/process/${processId}/status`, { cache: "no-store" });
  if (!res.ok) throw new Error("status fetch failed");
  return res.json();
}

/**
 * Use live status for a processId.
 * Returns: { data, live }
 *   - data: latest snapshot/event (or null while loading)
 *   - live: true if updates are coming via WebSocket; false if via REST fallback
 */
export function useProcessStatus(processId, options) {
  const opts = options || {};
  const fallbackPollMs = typeof opts.fallbackPollMs === "number" ? opts.fallbackPollMs : 4000;
  const enableWS = opts.enableWS !== false; // default true

  const [data, setData] = useState(null);
  const [live, setLive] = useState(false);     // WS delivery?
  const pollRef = useRef(null);

  useEffect(() => {
    if (!processId) return;

    let mounted = true;
    const topic = `proc:${processId}`;

    function onMsg(msg) {
      if (!mounted) return;
      if (msg.type === "snapshot") {
        setData(msg.item);
        setLive(true);
      } else if (msg.type === "event") {
        setData(msg.data);
        setLive(true);
      }
    }

    // Connect WS and subscribe
    if (enableWS) {
      ensureSocket();
      subscribe(topic, onMsg);
    }

    // Fallback: if WS doesn't deliver within ~1.2s, start polling REST
    (async () => {
      await new Promise(r => setTimeout(r, 1200));
      if (!mounted || live) return;
      try {
        const snap = await fetchStatusREST(processId);
        if (!mounted) return;
        setData(snap);
      } catch {}
      pollRef.current = window.setInterval(async () => {
        try {
          const snap = await fetchStatusREST(processId);
          if (mounted) setData(snap);
        } catch {}
      }, fallbackPollMs);
    })();

    return () => {
      mounted = false;
      if (enableWS) unsubscribe(topic, onMsg);
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  // re-run if processId changes
  }, [processId, enableWS, fallbackPollMs, live]);

  return { data, live };
}








import { useProcessStatus } from "../hooks/useProcessStatus";

export default function NodeStatusCard({ processId }) {
  const { data, live } = useProcessStatus(processId, { enableWS: true, fallbackPollMs: 5000 });

  if (!data) return <div>Loading…</div>;

  return (
    <div className="node-status">
      <div><b>Process:</b> {data.process_id}</div>
      <div><b>State:</b> {data.state} {live ? "• live" : "• fallback"}</div>
      <div><b>Progress:</b> {data.progress}%</div>
      {data.meta && data.meta.message && (
        <div><b>Info:</b> {data.meta.message}</div>
      )}
    </div>
  );
}











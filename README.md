async def subscribe_to_task(self, websocket: WebSocket, task_id: str) -> bool:
    if websocket not in self.active_connections:
        logging.warning("⚠️ Cannot subscribe: WebSocket not in active connections")
        return False

    # --- in-memory bookkeeping (keep this) ---
    if task_id not in self.task_subscriptions:
        self.task_subscriptions[task_id] = set()

    self.task_subscriptions[task_id].add(websocket)
    self.active_connections[websocket]["subscriptions"].add(task_id)

    key = (websocket, task_id)

    # ✅ STRICT: Prevent duplicate pollers for same ws+task
    if key in self.subscription_pollers:
        logging.info(f"✅ Poller already running for task {task_id} on this WS")
        return True

    async def poll_task_status():
        last_payload = None
        logging.info(f"▶️ POLLER STARTED | ws={id(websocket)} | task={task_id}")

        try:
            while True:
                # stop if ws disconnected or unsubscribed
                if websocket not in self.active_connections:
                    break
                if task_id not in self.active_connections[websocket]["subscriptions"]:
                    break

                data = read_task_status(task_id)

                if data is None:
                    await websocket.send_json({
                        "type": "task_not_found",
                        "task_id": task_id,
                    })
                    break

                if data != last_payload:
                    last_payload = data
                    await websocket.send_json({
                        "type": "task_update",
                        "task_id": task_id,
                        "data": data,
                    })

                await asyncio.sleep(self.POLL_INTERVAL)

        except asyncio.CancelledError:
            logging.info(f"🛑 POLLER CANCELLED | ws={id(websocket)} | task={task_id}")
        except Exception as e:
            logging.error(f"[POLL-ERROR] task={task_id}: {e}", exc_info=True)

        finally:
            self.subscription_pollers.pop(key, None)
            logging.info(f"🧹 POLLER CLEANED | ws={id(websocket)} | task={task_id}")

    self.subscription_pollers[key] = asyncio.create_task(poll_task_status())

    logging.info(
        f"✅ Subscribed WS {id(websocket)} to task {task_id} | "
        f"Active pollers={len(self.subscription_pollers)}"
    )
    return True





async def unsubscribe_from_task(self, websocket: WebSocket, task_id: str):
    key = (websocket, task_id)

    # stop poller
    poller = self.subscription_pollers.pop(key, None)
    if poller:
        poller.cancel()

    # remove from task_subscriptions
    subs = self.task_subscriptions.get(task_id)
    if subs:
        subs.discard(websocket)
        if not subs:
            self.task_subscriptions.pop(task_id, None)

    # remove from connection metadata
    if websocket in self.active_connections:
        self.active_connections[websocket]["subscriptions"].discard(task_id)

    logging.info(f"🛑 Unsubscribed WS {id(websocket)} from task {task_id}")






async def disconnect(self, websocket: WebSocket):
    # cancel all pollers for this websocket
    for (ws, task_id), task in list(self.subscription_pollers.items()):
        if ws is websocket:
            task.cancel()
            del self.subscription_pollers[(ws, task_id)]

    # remove from all task subscriptions
    for task_id, subs in list(self.task_subscriptions.items()):
        if websocket in subs:
            subs.discard(websocket)
            if not subs:
                self.task_subscriptions.pop(task_id, None)

    self.active_connections.pop(websocket, None)
    logging.info(f"❌ WS {id(websocket)} disconnected (all pollers cleaned)")






tmp_path = f"{task_id}.json.tmp"
with open(tmp_path, "w") as f:
    json.dump(data, f)
os.replace(tmp_path, f"{task_id}.json")  # atomic swap



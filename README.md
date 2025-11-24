<!doctype html>
<html>
<body>
<script>
  const ws = new WebSocket("ws://localhost:8000/ws");

  ws.onopen = () => {
    console.log("OPEN");
    ws.send("hello");
  };

  ws.onmessage = (e) => console.log("MSG:", e.data);
  ws.onerror = (e) => console.log("ERR:", e);
  ws.onclose = (e) => console.log("CLOSE:", e.code, e.reason);
</script>
</body>
</html>

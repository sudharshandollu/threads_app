<!doctype html><meta charset="utf-8">
<button id="go">Connect</button>
<script>
document.getElementById('go').onclick = () => {
  const s = location.protocol === 'https:' ? 'wss' : 'ws';
  const sock = new WebSocket(`${s}://localhost:8000/ws?instance=test`); // or /api/ws
  sock.onopen = () => console.log('OPEN');
  sock.onmessage = e => console.log('MSG', e.data);
  sock.onerror = e => console.log('ERR', e);
  sock.onclose = e => console.log('CLOSE', e.code, e.reason);
};
</script>

import { WebSocketServer, WebSocket } from 'ws'

const ANIMALS_SOCKET_PATH = '/ws/animals'

export function createAnimalsWebSocketServer(httpServer, listAnimals){
  const wss = new WebSocketServer({ server: httpServer, path: ANIMALS_SOCKET_PATH})

  async function broadcastAnimals(animalsData) {

    const message = JSON.stringify(animalsData);

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  wss.on("connection", (ws) => {
    console.log("WebSocket client connected");

    ws.on("close", () => {
      console.log("WebSocket client disconnected");
    });
  });
  
  wss.on('close', () => clearInterval(broadcastInterval))

  const broadcastInterval = setInterval(async () => {
    const data = await listAnimals();
    broadcastAnimals(data);
    console.log("Sending data from webSocket to client."+data);
  }, 1000);
}

/** 
  const UPSTREAM = process.env.UPSTREAM_URL  // e.g. https://your-api/api/animals
  const POLL_MS = 1000

  let latestPayload = null

  async function pollUpstream() {
    try {
      const res = await fetch(UPSTREAM)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data = await res.json()
      // Whatever shape your upstream returns, wrap it in a `type` envelope.
      latestPayload = { type: 'animals', data: data.animals ?? data, ts: Date.now() }

      const json = JSON.stringify(latestPayload)
      for (const client of wss.clients) {
        if (client.readyState === 1  OPEN ) {
          // basic backpressure: skip slow clients
          if (client.bufferedAmount < 1_000_000) client.send(json)
        }
      }
    } catch (err) {
      console.error('[poll] upstream error:', err.message)
      const errMsg = JSON.stringify({ type: 'error', message: 'Upstream fetch failed' })
      for (const client of wss.clients) {
        if (client.readyState === 1) client.send(errMsg)
      }
    }
  }

  setInterval(pollUpstream, POLL_MS)
  pollUpstream() // prime immediately

  // On connect, send the current snapshot so the UI doesn't wait up to 1s
  wss.on('connection', (ws) => {
    if (latestPayload) ws.send(JSON.stringify(latestPayload))

    // heartbeat: browsers won't always notice a dead TCP connection
    ws.isAlive = true
    ws.on('pong', () => { ws.isAlive = true })
  })

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) { ws.terminate(); continue }
      ws.isAlive = false
      ws.ping()
    }
  }, 30_000)

  wss.on('close', () => clearInterval(heartbeat))
  */

/**
 * Serves the animal dashboard's live data stream over the same HTTP server as
 * the REST API. Each message contains the complete current list because the
 * client replaces its local animal collection with the received data.
 */
/**
 * 
export function createAnimalsWebSocketServer(httpServer, listAnimals) {
  const webSocketServer = new WebSocketServer({ noServer: true })

  async function sendAnimals(socket, type = 'animals') {
    try {
      const animals = await listAnimals()

      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type, data: animals }))
      }
    } catch (error) {
      console.error('Could not load animals for WebSocket clients:', error)

      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'error', message: 'Could not load animals' }))
      }
    }
  }

  httpServer.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url || '/', 'http://localhost')

    if (requestUrl.pathname !== ANIMALS_SOCKET_PATH) {
      socket.destroy()
      return
    }

    webSocketServer.handleUpgrade(request, socket, head, (client) => {
      webSocketServer.emit('connection', client, request)
    })
  })

  webSocketServer.on('connection', (socket) => {
    void sendAnimals(socket)
  })

  return {
    async broadcastAnimals() {
      const clients = [...webSocketServer.clients]
        .filter((socket) => socket.readyState === WebSocket.OPEN)

      if (clients.length === 0) return

      try {
        const animals = await listAnimals()
        const message = JSON.stringify({ type: 'update', data: animals })

        for (const socket of clients) {
          socket.send(message)
        }
      } catch (error) {
        console.error('Could not broadcast animal update:', error)
      }
    },

    close(callback) {
      for (const socket of webSocketServer.clients) socket.terminate()
      webSocketServer.close(callback)
    },
  }
}
*/
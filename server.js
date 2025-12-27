const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { WebSocketServer } = require('ws')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// In-memory store: sessionId -> Set of WebSocket connections
const sessions = new Map()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Create WebSocket server
  const wss = new WebSocketServer({ noServer: true })

  // Handle WebSocket upgrade
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url)

    // Check if this is a game WebSocket connection
    const match = pathname.match(/^\/api\/game\/([^/]+)$/)
    if (match) {
      const sessionId = match[1]
      
      wss.handleUpgrade(request, socket, head, (ws) => {
        addToSession(sessionId, ws)
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString())
            broadcastToSession(sessionId, ws, message)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        })

        ws.on('close', () => {
          removeFromSession(sessionId, ws)
        })

        ws.on('error', (error) => {
          console.error('WebSocket error:', error)
          removeFromSession(sessionId, ws)
        })
      })
    } else {
      socket.destroy()
    }
  })

  function addToSession(sessionId, ws) {
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, new Set())
    }
    sessions.get(sessionId).add(ws)
  }

  function removeFromSession(sessionId, ws) {
    const session = sessions.get(sessionId)
    if (session) {
      session.delete(ws)
      if (session.size === 0) {
        // Cleanup after 5 minutes
        setTimeout(() => {
          if (sessions.get(sessionId)?.size === 0) {
            sessions.delete(sessionId)
          }
        }, 5 * 60 * 1000)
      }
    }
  }

  function broadcastToSession(sessionId, sender, data) {
    const session = sessions.get(sessionId)
    if (!session) return

    session.forEach(ws => {
      if (ws !== sender && ws.readyState === 1) { // 1 = OPEN
        ws.send(JSON.stringify(data))
      }
    })
  }

  server.listen(port, '0.0.0.0', (err) => {
    if (err) throw err
    console.log(`> Ready on http://0.0.0.0:${port}`)
  })
})


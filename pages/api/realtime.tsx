import { NextApiRequest, NextApiResponse } from 'next';
import WebSocket from "ws";

const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { message } = req.body;

    // Set up response headers for streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    });

    const ws = new WebSocket(url, {
      headers: {
        "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    ws.on("open", function open() {
      console.log("Connected to server.");
      ws.send(JSON.stringify({
        type: "session.update",
        session: {
          audio_encoding: "pcm_s16le_24khz"
        }
      }));

      // Send response.create after session.update
      ws.send(JSON.stringify({
        type: "response.create",
        response: {
          modalities: ["text", "audio"],
          instructions: "You are a helpful assistant. tell me a joke.",
        }
      }));

      // Send the user's message
      ws.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: message
            }
          ]
        }
      }));
    });

    ws.on("message", function incoming(data) {
      const message = JSON.parse(data.toString());
      console.log("Received:", message);
      // Stream the message to the client
      res.write(`data: ${JSON.stringify(message)}\n\n`);
    });

    ws.on("close", function close() {
      console.log("Disconnected from server.");
      res.end();
    });

    ws.on("error", function error(err) {
      console.log("Error:", err);
      res.status(500).json({ error: 'WebSocket error occurred' });
    });

    // Handle client disconnection
    req.on('close', () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
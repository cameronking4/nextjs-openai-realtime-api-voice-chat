import { NextRequest } from 'next/server';

const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const { message } = await req.json();

  const stream = new ReadableStream({
    start(controller) {
      const ws = new WebSocket(url, {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1",
        },
      });

      ws.onopen = () => {
        console.log("Connected to server.");
        // Send initial session update
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
      };

      ws.onmessage = (event) => {
        let receivedMessage;

        // Check if the data is a string or ArrayBuffer
        if (typeof event.data === 'string') {
          // If data is already a string, parse it
          receivedMessage = JSON.parse(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          // Convert ArrayBuffer to string using TextDecoder before parsing
          const text = new TextDecoder().decode(event.data);
          receivedMessage = JSON.parse(text);
        } else {
          console.error('Unsupported data type:', typeof event.data);
          return;
        }

        console.log("Received:", receivedMessage);

        // Stream the message to the client
        controller.enqueue(`data: ${JSON.stringify(receivedMessage)}\n\n`);
      };

      ws.onclose = () => {
        console.log("Disconnected from server.");
        controller.close();
      };

      ws.onerror = (err) => {
        console.log("Error:", err);
        controller.error('WebSocket error occurred');
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}

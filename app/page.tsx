'use client';
import { MicrophoneIcon } from "@heroicons/react/16/solid";
import { ArrowPathIcon } from "@heroicons/react/20/solid";
import { CloudArrowDownIcon } from "@heroicons/react/24/solid";
import { useEffect, useRef, useState } from "react";
import Typewriter from "../components/Typewriter";

interface Window { // add webkitSpeechRecognition to window
  webkitSpeechRecognition: any;
}

export default function Home() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ type: string; value: string }>>([]);
  const [prompt, setPrompt] = useState('');
  const [showModel, setShowModel] = useState(false);
  const [model, setModel] = useState('gpt-4o-mini-2024-07-18'); // default model
  const [reply, setReply] = useState("");
  const [recognition, setRecognition] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [audioChunks, setAudioChunks] = useState<string[]>([]);
  const [audioQueue, setAudioQueue] = useState<string[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  let buffer = '';
  // Function to convert base64 to Float32Array
  const base64ToFloat32Array = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length / 2;
    const float32Array = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const offset = i * 2;
      const lowByte = binaryString.charCodeAt(offset);
      const highByte = binaryString.charCodeAt(offset + 1);
      let sample = (highByte << 8) | lowByte;
      if (sample >= 0x8000) sample -= 0x10000; // Convert to signed 16-bit
      float32Array[i] = sample / 0x8000; // Normalize to -1.0 to 1.0
    }
    return float32Array;
  };

  const sendMessage = async (recordedText: string) => {
    setLoading(true);
    const newMessage = {
      type: "user",
      value: recordedText
    };

    setMessages(prevMessages => [...prevMessages, newMessage]);
    setPrompt("");

    try {
      const response = await fetch('/api/realtime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: recordedText })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      let accumulatedText = '';
      let currentAudioChunks: string[] = [];
      let buffer = '';

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        buffer += chunk;

        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep the last incomplete event in the buffer

        for (const event of events) {
          if (event.startsWith('data: ')) {
            try {
              const jsonData = event.slice(6);
              const parsedEvent = JSON.parse(jsonData);
              console.log("Received event:", parsedEvent);

              if (parsedEvent.type === 'response.audio_transcript.delta') {
                accumulatedText += parsedEvent.delta;
                updateMessages(accumulatedText);
              } else if (parsedEvent.type === 'response.audio.delta') {
                currentAudioChunks.push(parsedEvent.delta);
              } else if (parsedEvent.type === 'response.audio.done') {
                if (currentAudioChunks.length > 0) {
                  const combinedBase64Audio = currentAudioChunks.join('');
                  setAudioQueue(prevQueue => [...prevQueue, combinedBase64Audio]);
                  currentAudioChunks = []; // Reset for next audio segment
                }
              } else if (parsedEvent.type === 'response.audio_transcript.done') {
                updateMessages(parsedEvent.transcript);
              }
            } catch (error) {
              console.error("Error processing event:", error, "Raw event:", event);
            }
          }
        }
      }

    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setLoading(false);
      // Trigger audio playback after the message is processed
      playNextAudio();
    }
  };

  const updateMessages = (text: string) => {
    setMessages(prevMessages => {
      const lastMessage = prevMessages[prevMessages.length - 1];
      if (lastMessage && lastMessage.type === 'assistant') {
        const updatedMessages = [...prevMessages];
        updatedMessages[updatedMessages.length - 1] = { type: "assistant", value: text };
        return updatedMessages;
      } else {
        return [...prevMessages, { type: "assistant", value: text }];
      }
    });
    setLoading(false);
  };

  const MIN_AUDIO_BUFFER_SIZE = 1000; // Adjust this value as needed

  const playNextAudio = async () => {
    if (audioQueue.length === 0 || isPlaying) return;

    console.log("Attempting to play next audio");
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const audioContext = audioContextRef.current!;
    let audioBuffer = '';

    while (audioBuffer.length < MIN_AUDIO_BUFFER_SIZE && audioQueue.length > 0) {
      audioBuffer += audioQueue.shift() || '';
    }

    if (audioBuffer.length < MIN_AUDIO_BUFFER_SIZE) {
      console.log("Not enough audio data, waiting for more...");
      return;
    }

    setIsPlaying(true);

    try {
      const float32Array = base64ToFloat32Array(audioBuffer);

      // Create an AudioBuffer
      const buffer = audioContext.createBuffer(
        1, // numberOfChannels
        float32Array.length,
        24000 // sampleRate
      );
      buffer.copyToChannel(float32Array, 0);

      // Play the AudioBuffer
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();

      source.onended = () => {
        console.log("Audio ended");
        setIsPlaying(false);
        playNextAudio(); // Try to play the next audio chunk
      };
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsPlaying(false);
      playNextAudio(); // Try to play the next audio chunk even if this one failed
    }
  };

  useEffect(() => {
    if (audioQueue.length > 0 && !isPlaying) {
      playNextAudio();
    }
  }, [audioQueue, isPlaying]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { // close model on click outside
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setShowModel(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [modelRef]);

  const handleClick = () => { // stop audio on click
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }

  useEffect(() => { // check if speech recognition is available
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as Window).webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event: any) => { // on result, set the prompt and send the message
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const recordedText = event.results[i][0].transcript;
            handleClick();
            setPrompt(recordedText);
            sendMessage(recordedText);
          }
        }
      };
      setRecognition(recognition);
    } else {
      alert('Speech recognition not available');
    }
  }, []);

  const startListening = () => { // start listening to microphone
    setReply("Hello! I'm Groqet, start speaking to ask me a question.")
    setIsListening(true);
    if (recognition) {
      recognition.start();
    }
  };

  const stopListening = () => { // stop listening
    setIsListening(false);
    if (recognition) {
      recognition.stop();
    }
  };

  // download all messages as a text file
  const downloadMessages = () => {
    const messagesText = messages.map((message) => `${message.type}: ${message.value}`).join('\n');
    const blob = new Blob([messagesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'groqet-messages.txt';
    a.click();
  };

  useEffect(() => { // Try scroll to bottom of chat window
    if (windowRef.current) {
      const scrollHeight = windowRef.current.scrollHeight;
      windowRef.current.scrollTop = scrollHeight
    }
  }, [messages, windowRef]);

  return (<div>
    {Header()}
    <main className="flex flex-col items-center justify-between w-full h-svh">
      <div
        ref={windowRef}
        className="flex-1 overflow-auto flex flex-col gap-4 w-full h-svh py-12"
      >
        {messages.map((item, index) => item.value !== "" &&
          <div
            onClick={() => handleClick()}
            key={index} className={`mx-6 shadow border items-start rounded-2xl md:items-center max-w-5xl ${item.type === "user" ? "text-right self-end bg-green-100 ml-24" : "bg-white mr-24"}`}>
            <Typewriter
              fontSize={14}
              delay={0}
              infinite={false}
              text={item.value}
            />
          </div>)}



      </div>

      <div className="p-2 flex items-center gap-4 w-full bg-gray-100 px-4 border-t border-gray-200">

        <CloudArrowDownIcon
          onClick={downloadMessages}
          className="h-6 w-6 text-gray-500 hover:text-black cursor-pointer" />

        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              sendMessage(prompt);
            }
          }}
          className="flex bg-white w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex-1"
          placeholder="Ask me a question"
        />

        <button
          disabled={loading}
          onClick={() => sendMessage(prompt)}
          className="rounded-lg bg-black p-2 text-white">
          {loading ? <ArrowPathIcon className="h-6 w-6 animate-spin" aria-hidden="true" />
            : "Send"}
        </button>

        {!isListening ?
          <MicrophoneIcon
            onClick={startListening}
            className="h-6 w-6 text-gray-500 hover:text-black cursor-pointer" />
          :
          <MicrophoneIcon
            onClick={stopListening}
            className="h-6 w-6 text-red-500 animate-pulse cursor-pointer" />
        }
      </div>
    </main>
  </div>
  );

  function Header() {
    return <div className="flex fixed top-0 py-1 gap-2 w-full px-2 items-center font-mono">
      {!reply &&
        <div className="">
          <a href="https://x.com/aaronbesson" className="text-xs opacity-50" target="_blank">@aaronbesson</a>
        </div>}
    </div>;
  }
}
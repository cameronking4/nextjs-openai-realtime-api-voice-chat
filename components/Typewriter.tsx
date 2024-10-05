"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

// Define the props type for TypeScript safety
interface TypewriterProps {
  text: string;
  delay: number;
  infinite?: boolean;
  fontSize?: number;
}

const Typewriter: React.FC<TypewriterProps> = ({ text, delay, infinite = false, fontSize = 16 }) => {
  const [currentText, setCurrentText] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (currentIndex < text.length) {
      timeout = setTimeout(() => {
        setCurrentText((prevText) => prevText + text[currentIndex]);
        setCurrentIndex((prevIndex) => prevIndex + 1);
      }, delay);
    } else if (infinite) {
      setCurrentIndex(0);
      setCurrentText("");
    }

    return () => clearTimeout(timeout);
  }, [currentIndex, delay, infinite, text]);

  return (
    <ReactMarkdown
      className="p-4 text-left w-full"
      components={{
        p: ({ node, ...props }) => (
          <p
            style={{
              fontSize: `${fontSize}px`,
              fontWeight: "300", // Changed 'thin' to numeric value (CSS standard)
            }}
            {...props}
          />
        ),
      }}
    >
      {currentText}
    </ReactMarkdown>
  );
};

export default Typewriter;

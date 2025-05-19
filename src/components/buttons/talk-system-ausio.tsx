"use client";
import React, { useEffect, useState, useRef } from "react";
import { Button } from "../ui/button";
import { Loader2, Mic, MicOff } from "lucide-react";
import { useGroq } from "@/hooks/useOpenAI";

// Define message type for conversation history
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

function Talk() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voices, setVoices] = useState<Array<SpeechSynthesisVoice>>();
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pausedResponseText, setPausedResponseText] = useState<string | null>(
    null
  );

  const isUserSpeakingRef = useRef(false);
  const pendingTranscriptRef = useRef("");
  const lastUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const goodVoiceNames = [
    "Samantha",
    "Google US English",
    "Google UK English Female",
    "Google UK English Male",
    "Rocko (English (United States))",
    "Nicky",
    "Rocko",
    "Arthur",
    "Karen",
    "Tessa",
  ];

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const {
    mutate: sendMessage,
    isPending: loading,
    isError,
    error,
    data: response,
    reset,
  } = useGroq();

  // Initialize speech recognition and clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }

      // Stop any ongoing speech
      window.speechSynthesis.cancel();
    };
  }, []);

  // Initialize available voices
  useEffect(() => {
    const voices = window.speechSynthesis.getVoices();
    if (Array.isArray(voices) && voices.length > 0) {
      setVoices(filterVoices(voices));
      // Set default voice
      if (voices.length > 0) {
        const defaultVoice =
          voices.find((v) => v.name === goodVoiceNames[0]) || voices[0];
        setVoice(defaultVoice);
      }
      return;
    }

    if ("onvoiceschanged" in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = function () {
        const voices = window.speechSynthesis.getVoices();
        const filteredVoices = filterVoices(voices);
        setVoices(filteredVoices);

        // Set default voice
        if (filteredVoices.length > 0) {
          setVoice(filteredVoices[0]);
        }
      };
    }
  }, []);

  // Filter voices based on preferred voice names
  const filterVoices = (voices: SpeechSynthesisVoice[]) => {
    const filtered = voices.filter((voice) => {
      return goodVoiceNames.includes(voice.name);
    });
    return filtered.length > 0 ? filtered : voices;
  };

  // Handle user speaking during response
  const handleUserStartedSpeaking = () => {
    // If the API is still loading, cancel the request
    if (loading) {
      console.log("User spoke during loading, cancelling request");
      reset();
    }
    // If there's speech happening, pause it but don't cancel
    else if (isSpeaking) {
      console.log("User spoke during speaking, pausing speech synthesis");
      window.speechSynthesis.pause();
    }
  };

  // Start speech recognition
  const startRecording = () => {
    setIsRecording(true);
    setTranscript("");
    pendingTranscriptRef.current = "";
    reset(); // Reset any previous responses

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onspeechstart = () => {
      console.log("User started speaking");
      isUserSpeakingRef.current = true;
      handleUserStartedSpeaking();
    };

    console.log("Recording started");

    recognitionRef.current.onresult = (event) => {
      isUserSpeakingRef.current = true;

      const results = event.results;
      const currentResult = results[results.length - 1];

      // Handle user speaking during response
      handleUserStartedSpeaking();

      // If the current result is final
      if (currentResult.isFinal) {
        const finalTranscript = currentResult[0].transcript;
        // Update both displayed transcript and pending transcript
        const fullTranscript = transcript + " " + finalTranscript;
        setTranscript(fullTranscript.trim());
        pendingTranscriptRef.current = fullTranscript.trim();

        // Send message immediately when we have a final result
        console.log(
          "Sending message with final transcript:",
          pendingTranscriptRef.current
        );
        sendMessage(pendingTranscriptRef.current);

        // Mark user as no longer speaking
        isUserSpeakingRef.current = false;
      } else {
        // Show interim results in real-time
        const interimTranscript = currentResult[0].transcript;
        setTranscript((prev) => {
          // For interim results, just show the combined text
          return (prev + " " + interimTranscript).trim();
        });
      }
    };

    recognitionRef.current.onspeechend = () => {
      isUserSpeakingRef.current = false;

      // If speech was paused and there's a response, resume it
      if (response && !loading && window.speechSynthesis.paused) {
        console.log("User stopped speaking, resuming speech synthesis");
        window.speechSynthesis.resume();
      }
    };

    recognitionRef.current.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
    };

    recognitionRef.current.onend = () => {
      // If recording is still enabled but recognition ended, restart it
      if (isRecording) {
        console.log("Recognition ended unexpectedly, restarting...");
        recognitionRef.current?.start();
      }
    };

    recognitionRef.current.start();
  };

  // Stop recording
  const stopRecording = () => {
    setIsRecording(false);

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // If there's transcript content and we're not already loading, send it
    if (pendingTranscriptRef.current && !loading) {
      console.log(
        "Sending final message on stop:",
        pendingTranscriptRef.current
      );
      sendMessage(pendingTranscriptRef.current);
    }
  };

  // Add message to history
  const addMessageToHistory = (role: "user" | "assistant", content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newMessage]);
  };

  // Function to speak the response
  const SageTalk = (text: string) => {
    // If we're already speaking or there's a paused response, cancel it
    if (isSpeaking || window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    lastUtteranceRef.current = utterance;

    if (voice) {
      utterance.voice = voice;
    } else if (voices && voices.length > 0) {
      utterance.voice = voices[0];
    }

    // Add event handlers to track when speech is complete
    utterance.onend = () => {
      setIsSpeaking(false);
      lastUtteranceRef.current = null;

      // Add the user's message to history first (if not empty)
      if (transcript.trim()) {
        addMessageToHistory("user", transcript);
      }

      // Add the assistant's response to history
      addMessageToHistory("assistant", text);

      // Reset transcript when the response finishes speaking
      setTranscript("");
      pendingTranscriptRef.current = "";
    };

    utterance.onerror = (event) => {
      console.error("Speech synthesis error:", event);
      setIsSpeaking(false);
      lastUtteranceRef.current = null;
    };

    // Handle pausing
    utterance.onpause = () => {
      console.log("Speech synthesis paused");
      setPausedResponseText(text);
    };

    // Handle resuming
    utterance.onresume = () => {
      console.log("Speech synthesis resumed");
      setPausedResponseText(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Speak response when it arrives
  useEffect(() => {
    if (response && !isUserSpeakingRef.current) {
      const text = response.choices[0].message.content;
      if (text) {
        SageTalk(text);
      }
    }
  }, [response]);

  return (
    <div className="space-y-4">
      <Button
        onClick={isRecording ? stopRecording : startRecording}
        className="flex items-center space-x-2"
      >
        {isRecording ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        <span>{isRecording ? "Stop Recording" : "Start Recording"}</span>
      </Button>

      {/* Current transcript display */}
      <div className="bg-accent p-4 rounded-md min-h-40 w-full max-w-lg">
        <p className="text-center font-medium mb-2">You said:</p>
        <p className="whitespace-pre-wrap">{transcript}</p>
        {isUserSpeakingRef.current && isRecording && (
          <div className="mt-2 text-sm text-blue-500">Listening...</div>
        )}
      </div>

      {/* Voice selection */}
      {voices && voices.length > 0 && (
        <div className="flex items-center space-x-2">
          <label htmlFor="voice-select" className="text-sm font-medium">
            Select Voice:
          </label>
          <select
            id="voice-select"
            className="p-2 border rounded-md"
            onChange={(e) => {
              const selectedVoice = voices.find(
                (v) => v.name === e.target.value
              );
              setVoice(selectedVoice || null);
            }}
            value={voice?.name || ""}
          >
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Error display */}
      {isError && (
        <div className="p-4 bg-red-100 text-red-700 rounded-md">
          <p className="font-bold">Error:</p>
          <p>{error instanceof Error ? error.message : "Unknown error"}</p>
        </div>
      )}

      {/* Current response display */}
      {(loading || response || pausedResponseText) && (
        <div className="bg-accent p-4 rounded-md min-h-40 w-full max-w-lg">
          <p className="text-center font-medium mb-2">Response:</p>
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2">Thinking...</span>
            </div>
          ) : (
            <div>
              <p className="whitespace-pre-wrap">
                {pausedResponseText || response?.choices[0].message.content}
              </p>
              {isSpeaking && (
                <div className="mt-2 text-sm text-green-500">
                  {window.speechSynthesis.paused ? "Paused" : "Speaking..."}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Conversation history */}
      {messages.length > 0 && (
        <div className="mt-8 border-t pt-4">
          <h3 className="font-medium mb-4">Conversation History</h3>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg max-w-lg ${
                  message.role === "user"
                    ? "bg-blue-600 text-white ml-auto"
                    : "bg-gray-600 text-white"
                }`}
              >
                <div className="font-medium mb-1">
                  {message.role === "user" ? "You" : "Assistant"}:
                </div>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Talk;

"use client";
import React, { useEffect, useState, useRef } from "react";
import { Button } from "../ui/button";
import { Loader2, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useGroq } from "@/hooks/useOpenAI";
import { useMeloTTS } from "@/hooks/useMeloniTTS";

// Define message type for conversation history
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

function Talk2() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [responseText, setResponseText] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const isUserSpeakingRef = useRef(false);
  const pendingTranscriptRef = useRef("");

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Groq hook for text generation
  const {
    mutate: sendMessage,
    isPending: loading,
    isError,
    error,
    data: response,
    reset,
  } = useGroq();

  // Melo TTS hook for speech synthesis
  const {
    speak: generateSpeech,
    isPending: loadingTTS,
    isError: isTTSError,
    error: ttsError,
    playAudio,
    pauseAudio,
    resumeAudio,
    stopAudio,
    audioElement,
  } = useMeloTTS({
    defaultSpeaker: "EN-US",
    defaultSpeed: 1.0, // Using a fixed default speed
    onSuccess: (data) => {
      console.log("TTS audio generated successfully, URL:", data.audioUrl);

      if (!isMuted) {
        audioRef.current = new Audio(data.audioUrl);
        audioRef.current.play().catch((error) => {
          console.error("Error playing audio:", error);
        });
        // setTimeout(() => {
        //   playAudio().catch((err) =>
        //     console.error("Error playing audio after generation:", err)
        //   );
        // }, 100); // Small delay to ensure audio is fully loaded
      }
    },
    onError: (error) => {
      console.error("TTS generation error:", error);
    },
    autoPlay: false, // We'll handle playback ourselves for more control
  });

  // Set up audio element event listeners for tracking speech state
  useEffect(() => {
    if (audioElement) {
      const handlePlay = () => {
        console.log("Audio started playing");
        setIsSpeaking(true);
      };

      const handlePause = () => {
        console.log("Audio paused");
        if (!isUserSpeakingRef.current) {
          setIsSpeaking(false);
        }
      };

      const handleEnded = () => {
        console.log("Audio playback ended");
        setIsSpeaking(false);

        // After speaking finishes, add messages to history
        if (transcript.trim()) {
          addMessageToHistory("user", transcript);
        }

        if (responseText) {
          addMessageToHistory("assistant", responseText);
        }

        // Reset transcript
        setTranscript("");
        pendingTranscriptRef.current = "";
      };

      audioElement.addEventListener("play", handlePlay);
      audioElement.addEventListener("pause", handlePause);
      audioElement.addEventListener("ended", handleEnded);

      // Add error listener to debug audio issues
      audioElement.addEventListener("error", (e) => {
        console.error("Audio element error:", e);
      });

      return () => {
        audioElement.removeEventListener("play", handlePlay);
        audioElement.removeEventListener("pause", handlePause);
        audioElement.removeEventListener("ended", handleEnded);
        audioElement.removeEventListener("error", () => {});
      };
    }
  }, [audioElement, transcript, responseText]);

  // Initialize speech recognition and clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }

      // Stop any ongoing speech
      stopAudio();
    };
  }, [stopAudio]);

  // Handle user speaking during response
  const handleUserStartedSpeaking = () => {
    // If the API is still loading, cancel the request
    if (loading) {
      console.log("User spoke during loading, cancelling request");
      reset();
    }
    // If TTS is loading, do nothing - let it complete
    else if (loadingTTS) {
      console.log("User spoke during TTS generation, continuing generation");
    }
    // If there's speech happening, pause it but don't cancel
    else if (isSpeaking) {
      console.log("User spoke during speaking, pausing speech");
      audioRef.current?.pause();
    }
  };

  // Start speech recognition
  const startRecording = () => {
    setIsRecording(true);
    setTranscript("");
    pendingTranscriptRef.current = "";
    reset(); // Reset any previous responses
    stopAudio(); // Stop any ongoing audio playback

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error("SpeechRecognition API not supported in this browser");
      return;
    }

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
      audioRef.current?.pause();

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

      // If speech was paused and user finished speaking, resume it
      if (isSpeaking && audioElement?.paused) {
        console.log("User stopped speaking, resuming speech");
        resumeAudio().catch((err) =>
          console.error("Error resuming audio:", err)
        );
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

  // Toggle audio mute state
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      // Muting
      pauseAudio();
    } else if (responseText && !isUserSpeakingRef.current) {
      // Unmuting - only play if we have response and user isn't speaking
      playAudio().catch((err) =>
        console.error("Error playing audio after unmute:", err)
      );
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

  // When Groq response is received, generate speech
  useEffect(() => {
    if (response && !isUserSpeakingRef.current) {
      const text = response.choices[0].message.content;
      if (text) {
        setResponseText(text);
        console.log("Generating speech for response:", text);
        generateSpeech({ text });
      }
    }
  }, [response, generateSpeech]);

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Button
          onClick={isRecording ? stopRecording : startRecording}
          className="flex items-center space-x-2"
          disabled={loadingTTS} // Disable recording button while generating speech
        >
          {isRecording ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          <span>{isRecording ? "Stop Recording" : "Start Recording"}</span>
        </Button>

        <Button
          onClick={toggleMute}
          variant="outline"
          className="flex items-center space-x-2"
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
          <span>{isMuted ? "Unmute" : "Mute"}</span>
        </Button>
      </div>

      {/* Current transcript display */}
      <div className="bg-accent p-4 rounded-md min-h-40 w-full max-w-lg">
        <p className="text-center font-medium mb-2">You said:</p>
        <p className="whitespace-pre-wrap">{transcript}</p>
        {isUserSpeakingRef.current && isRecording && (
          <div className="mt-2 text-sm text-blue-500">Listening...</div>
        )}
      </div>

      {/* Error display */}
      {(isError || isTTSError) && (
        <div className="p-4 bg-red-100 text-red-700 rounded-md">
          <p className="font-bold">Error:</p>
          {isError && (
            <p>{error instanceof Error ? error.message : "Unknown error"}</p>
          )}
          {isTTSError && (
            <p>{ttsError instanceof Error ? ttsError.message : "TTS error"}</p>
          )}
        </div>
      )}

      {/* Current response display */}
      {(loading || loadingTTS || responseText) && (
        <div className="bg-accent p-4 rounded-md min-h-40 w-full max-w-lg">
          <p className="text-center font-medium mb-2">Response:</p>
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2">Thinking...</span>
            </div>
          ) : loadingTTS ? (
            <div className="flex flex-col items-center justify-center h-20">
              <div className="flex items-center mb-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2">Generating speech...</span>
              </div>
              <p className="text-sm text-gray-500">{responseText}</p>
            </div>
          ) : (
            <div>
              <p className="whitespace-pre-wrap">{responseText}</p>
              {isSpeaking && (
                <div className="mt-2 text-sm text-green-500">
                  {audioElement?.paused ? "Paused" : "Speaking..."}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Audio debug info - remove in production */}
      <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
        <p>
          Audio status:{" "}
          {audioElement
            ? audioElement.paused
              ? "Paused"
              : "Playing"
            : "No Audio"}
        </p>
        <p>Current time: {audioElement?.currentTime.toFixed(1) || 0}s</p>
        <p>
          Duration:{" "}
          {audioElement?.duration ? audioElement.duration.toFixed(1) : 0}s
        </p>
        <p>Ready state: {audioElement?.readyState || 0}</p>
      </div>

      {/* Conversation history */}
      {messages.length > 0 && (
        <div className="mt-8 border-t pt-4">
          <h3 className="font-medium mb-4">Conversation History</h3>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
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

export default Talk2;

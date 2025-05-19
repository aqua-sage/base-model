"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { io } from "socket.io-client";

export default function Talk() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const recordingIntervalRef = useRef(null);

  // Connect to WebSocket server on component mount
  useEffect(() => {
    // Replace with your WebSocket server URL
    const socket = io("http://localhost:8003");

    socket.on("connect", () => {
      setIsConnected(true);
      setError("");
      console.log("Connected to server");
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("Disconnected from server");
    });

    socket.on("connect_error", (err) => {
      setError(`Connection error: ${err.message}`);
      setIsConnected(false);
      console.error("Connection error:", err);
    });

    socket.on("transcription", (data) => {
      console.log("Received transcription:", data);
      if (data.text && data.text.trim()) {
        setTranscript((prev) => prev + " " + data.text.trim());
      }
      setIsProcessing(false);
    });

    socket.on("transcription_error", (data) => {
      console.error("Transcription error:", data.error);
      setError(`Transcription error: ${data.error}`);
      setIsProcessing(false);
    });

    socketRef.current = socket;

    // Initialize AudioContext
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
    } catch (e) {
      setError(`AudioContext not supported: ${e.message}`);
    }

    // Clean up on component unmount
    return () => {
      stopRecording();

      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const processAudioChunks = () => {
    if (audioChunksRef.current.length === 0) return;

    // Create blob from audio chunks
    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });

    // Convert to base64
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = () => {
      const base64Audio = reader.result;

      // Send to WebSocket
      setIsProcessing(true);
      socketRef.current.emit("audio_data", {
        audio: base64Audio,
        id: Date.now().toString(),
      });
    };

    // Clear audio chunks for next interval
    audioChunksRef.current = [];
  };

  const startRecording = async () => {
    try {
      setError("");

      // Check if WebSocket is connected
      if (!socketRef.current || !isConnected) {
        setError("WebSocket not connected. Please try again.");
        return;
      }

      // Get audio stream with PyAudio-like settings
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          sampleSize: 16,
          volume: 1.0,
        },
      });

      streamRef.current = stream;

      // Set up AudioContext for analysis
      if (audioContextRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(stream);
        const analyser = audioContextRef.current.createAnalyser();
        source.connect(analyser);
        analyserRef.current = analyser;
      }

      // Create MediaRecorder instance
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Configure the interval to process audio chunks
      recordingIntervalRef.current = setInterval(() => {
        processAudioChunks();
      }, 2000); // Process every 2 seconds

      // Notify server about streaming start
      socketRef.current.emit("start_stream", {});

      // Start recording with small timeslices to get frequent updates
      mediaRecorder.start(200); // Get data every 200ms
      setIsRecording(true);
      console.log("Recording started");
    } catch (err) {
      console.error("Error starting recording:", err);
      setError(`Error starting recording: ${err.message}`);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    console.log("Stopping recording");

    // Clear interval
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    // Stop current recorder
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();

      // Process any remaining audio chunks
      processAudioChunks();
    }

    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Notify server about streaming end
    if (socketRef.current && isConnected) {
      socketRef.current.emit("end_stream", {});
    }

    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const clearTranscript = () => {
    setTranscript("");
  };

  return (
    <div className="flex flex-col items-center space-y-4 p-4">
      <div className="flex flex-col items-center space-y-2">
        <div className="text-sm font-medium">
          {isConnected ? (
            <span className="text-green-500">Connected to server</span>
          ) : (
            <span className="text-red-500">Disconnected from server</span>
          )}
        </div>

        <Button
          onClick={toggleRecording}
          disabled={!isConnected}
          className={`w-16 h-16 rounded-full ${
            isRecording
              ? "bg-red-500 hover:bg-red-600"
              : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {isRecording ? (
            <MicOff className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </Button>

        <div className="text-sm font-medium">
          {isRecording ? "Listening..." : "Push to talk"}
          {isProcessing && <span className="ml-2">(Processing...)</span>}
        </div>
      </div>

      {error && (
        <div className="text-red-500 text-sm p-2 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      <div className="w-full max-w-lg mt-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">Transcript</h3>
          {transcript && (
            <Button variant="outline" size="sm" onClick={clearTranscript}>
              Clear
            </Button>
          )}
        </div>

        <div className="p-4 bg-gray-50 rounded-md min-h-32 max-h-64 overflow-y-auto">
          {transcript
            ? transcript.trim()
            : "Your transcription will appear here..."}
        </div>
      </div>
    </div>
  );
}

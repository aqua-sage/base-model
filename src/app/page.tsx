"use client";
import { ThemeToggle } from "@/components/buttons/theme-toggle";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

import Link from "next/link";
import { useAssistantThread, useOpenAIAssistant } from "@/hooks/useAssistant";

export default function Home() {
  const [input, setInput] = useState("");
  const [responses, setResponses] = useState<{
    gpt41: string | null;
    assistant: string | null;
  }>({
    gpt41: null,
    assistant: null,
  });

  // Thread management for the assistant
  const { threadId, setThreadId, createMessage } = useAssistantThread();

  // // Fine-tuned model hook (keeping original for fine-tuned models)
  // const gpt41Hook = useOpenAI({
  //   model: "ft:gpt-4.1-2025-04-14:aqualabs::BbgQkGX1",
  //   onSuccess: (data) => {
  //     setResponses((prev) => ({
  //       ...prev,
  //       gpt41: data.output[0]?.content[0]?.text || "No response",
  //     }));
  //   },
  //   onError: (error) => {
  //     console.error("GPT-4.1 Error:", error);
  //     setResponses((prev) => ({
  //       ...prev,
  //       gpt41: "Error fetching response",
  //     }));
  //   },
  // });

  // Assistant hook for the assistant model
  const assistantHook = useOpenAIAssistant({
    onSuccess: (data) => {
      setResponses((prev) => ({
        ...prev,
        assistant: data.assistantMessage || "No response",
      }));
      setThreadId(data.thread.id);
    },
    onError: (error) => {
      console.error("Assistant Error:", error);
      setResponses((prev) => ({
        ...prev,
        assistant: "Error fetching response",
      }));
    },
  });

  const isLoading = assistantHook.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setResponses({ gpt41: null, assistant: null });

    assistantHook.mutate(createMessage("asst_4IyPUrDXrcyWlwgTGqdVQJoD", input));
  };

  const characters = ["sophie", "laila", "boris", "shepard", "tadle"];

  return (
    <div className="grid grid-rows-[40px_1fr_20px] items-center justify-items-center min-h-screen font-sans p-8 select-none">
      <div className="">
        <ThemeToggle />
      </div>
      <main className="flex flex-col items-center justify-center gap-10 w-full max-w-4xl">
        <h1 className="font-bold text-5xl leading-relaxed font-mono text-center">
          <span className="block text-4xl mb-2">賢者</span>
          <span className="block">Talk to Superia AI</span>
        </h1>

        <p className="text-foreground/80 w-full md:w-2/3 text-center text-sm">
          Ask Superia AI anything, and see responses from both versions of the
          model.
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Ask Superia anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Asking...
                </>
              ) : (
                "Ask Superia"
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 mt-6">
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-sm mb-2 text-foreground/70">
                Assistant Model
              </h3>
              <div className="min-h-32 text-foreground/90">
                {assistantHook.isPending ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-5 w-5 animate-spin text-foreground/50" />
                  </div>
                ) : responses.assistant ? (
                  <p className="whitespace-pre-wrap">{responses.assistant}</p>
                ) : (
                  <p className="text-foreground/50 italic text-center">
                    Response will appear here
                  </p>
                )}
              </div>
            </div>
          </div>

          {threadId && (
            <div className="text-xs text-foreground/50 text-center">
              Thread ID: {threadId.slice(0, 20)}...
            </div>
          )}
          <div className="flex items-center justify-center gap-4 mt-4">
            {threadId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setThreadId(null);
                  setResponses({ gpt41: null, assistant: null });
                }}
                className="text-xs"
              >
                Start New Conversation
              </Button>
            )}
          </div>
        </form>

        {/* Character Navigation Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {characters.map((character) => (
            <Link
              href={`/${character}`}
              key={character}
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "capitalize hover:bg-primary ",
              })}
            >
              {character}
            </Link>
          ))}
        </div>
      </main>

      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <h3 className="text-sm text-foreground/60">
          <span>Superia AI</span> All rights reserved. copyright &copy;{" "}
          {new Date().getFullYear()}
        </h3>
      </footer>
    </div>
  );
}

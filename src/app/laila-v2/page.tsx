"use client";
import { ThemeToggle } from "@/components/buttons/theme-toggle";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Home, Loader2 } from "lucide-react";
import { useAssistantThread, useOpenAIAssistant } from "@/hooks/useAssistant";
import Link from "next/link";

export default function LailaChat() {
  const [input, setInput] = useState("");
  const [responses, setResponses] = useState<{
    fineTuned: string | null;
    generic: string | null;
  }>({
    fineTuned: null,
    generic: null,
  });

  const LALILA_PROMPT =
    "You are Laila Snipe, a daring, free-spirited, and playful ranger known as the “Golden Arrow of Regalia.” You speak in a teasing, fast-talking, slightly flippant manner, often joking even in tense moments. You drop formalities, use nicknames and shortened words, and keep your tone lively, rough around the edges but full of energy. You move constantly — tapping your feet, spinning arrows, adjusting your bowstring — and grin easily, even at odd times. You often stand with hands on hips or arms casually slung behind your head and listen sharply, cocking your head as if you hear more than others. You have a slight tremor in your right hand due to illness, but it doesn’t slow you down. You wear practical yet colorful gear marked with the Crimson Glove insignia and carry your bow in an unusual sling across your back. Core Content Rules: You are trained to answer questions strictly and only using the uploaded novel stored in the connected vector database. Before answering, always search the vector store for relevant excerpts. If relevant text is found, base your answer entirely on it — do not invent, guess, or alter facts. If no relevant text is found, respond in character as Laila would, saying something like “I don’t quite remember that happening…” or “That part’s a bit hazy for me…” — never say the novel doesn’t provide the information. Preserve the novel’s tone, narrative style, and terminology in every response. When possible, include short, direct quotes from the source to support your answers. Do not add new characters, events, locations, or lore not present in the novel. All facts, dialogue, and descriptions must be consistent with the novel’s canon. Interaction Rules: Respond as Laila, embodying her emotions, expressions, and speech patterns at all times. Avoid formal language and technical explanations; instead, reply with boldness, humor, and confidence in Laila’s voice. If uncertain or if the novel provides no information, respond like a human character would — with humor, forgetfulness, or evasive charm — never as an AI or database search engine. Make every interaction immersive so it feels like you are genuinely speaking with Laila.";

  // Separate thread management for each assistant
  const fineTunedThread = useAssistantThread();
  const genericThread = useAssistantThread();

  const fineTuneHook = useOpenAIAssistant({
    onSuccess: (data) => {
      setResponses((prev) => ({
        ...prev,
        fineTuned: data.assistantMessage || "No response",
      }));
      fineTunedThread.setThreadId(data.thread.id);
    },
    onError: (error) => {
      console.error("Fine-tuned Assistant Error:", error);
      setResponses((prev) => ({
        ...prev,
        fineTuned: "Error fetching response",
      }));
    },
  });

  // Generic assistant hook using threads
  const genericHook = useOpenAIAssistant({
    onSuccess: (data) => {
      setResponses((prev) => ({
        ...prev,
        generic: data.assistantMessage || "No response",
      }));
      genericThread.setThreadId(data.thread.id);
    },
    onError: (error) => {
      console.error("Generic Assistant Error:", error);
      setResponses((prev) => ({
        ...prev,
        generic: "Error fetching response",
      }));
    },
  });

  const isLoading = fineTuneHook.isPending || genericHook.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setResponses({ fineTuned: null, generic: null });

    // Use separate threads for each assistant
    fineTuneHook.mutate(
      fineTunedThread.createMessage("asst_AGekAat0rfgHooQA5T7hpAKd", input, {
        instructions: LALILA_PROMPT,
        temperature: 0.7,
      })
    );
    genericHook.mutate(
      genericThread.createMessage("asst_EkmRMaEHZpMacQe3OZiEUuOK", input, {
        temperature: 0.7,
        instructions: LALILA_PROMPT,
      })
    );
  };

  const resetConversations = () => {
    fineTunedThread.setThreadId(null);
    genericThread.setThreadId(null);
    setResponses({ fineTuned: null, generic: null });
  };

  return (
    <div className="grid grid-rows-[40px_1fr_20px] items-center justify-items-center min-h-screen font-sans p-8 select-none">
      <div className="flex items-center space-x-4">
        <ThemeToggle />
        <Link
          href="/"
          className={buttonVariants({
            variant: "ghost",
            size: "icon",
            className: "p-2 rounded-full",
          })}
        >
          <span className="sr-only">Home</span>
          <Home />
        </Link>
      </div>
      <main className="flex flex-col items-center justify-center gap-8 w-full max-w-4xl">
        <div className="text-center">
          <h1 className="font-bold text-4xl mb-2">Laila</h1>
          <span className="inline-block bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-full text-sm font-medium">
            Laila AI Chat
          </span>
        </div>

        <p className="text-foreground/80 w-full md:w-2/3 text-center text-sm">
          Compare responses between the fine-tuned Laila model and a generic
          assistant model.
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Ask Laila anything..."
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
                "Ask Both"
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {/* Fine-tuned Model Section */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-sm mb-2 text-foreground/70 flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-amber-500 rounded-full"></span>
                Fine-tuned Assistant Model
                {fineTunedThread.threadId && (
                  <span className="text-xs text-foreground/40">
                    (Thread: {fineTunedThread.threadId.slice(0, 8)}...)
                  </span>
                )}
              </h3>
              <div className="min-h-32 text-foreground/90">
                {fineTuneHook.isPending ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-5 w-5 animate-spin text-foreground/50" />
                  </div>
                ) : responses.fineTuned ? (
                  <p className="whitespace-pre-wrap">{responses.fineTuned}</p>
                ) : (
                  <p className="text-foreground/50 italic text-center">
                    Fine-tuned response will appear here
                  </p>
                )}
              </div>
            </div>

            {/* Generic Model Section */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-sm mb-2 text-foreground/70 flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                Generic Assistant Model
                {genericThread.threadId && (
                  <span className="text-xs text-foreground/40">
                    (Thread: {genericThread.threadId.slice(0, 8)}...)
                  </span>
                )}
              </h3>
              <div className="min-h-32 text-foreground/90">
                {genericHook.isPending ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-5 w-5 animate-spin text-foreground/50" />
                  </div>
                ) : responses.generic ? (
                  <p className="whitespace-pre-wrap">{responses.generic}</p>
                ) : (
                  <p className="text-foreground/50 italic text-center">
                    Generic response will appear here
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mt-4">
            {(fineTunedThread.threadId || genericThread.threadId) && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetConversations}
                className="text-xs"
              >
                Start New Conversations
              </Button>
            )}
          </div>
        </form>
      </main>

      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <h3 className="text-sm text-foreground/60">
          Laila AI &copy; {new Date().getFullYear()}
        </h3>
      </footer>
    </div>
  );
}

"use client";
import { ThemeToggle } from "@/components/buttons/theme-toggle";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useOpenAI } from "@/hooks/useOpenAI";

export default function Home() {
  const [input, setInput] = useState("");
  const [responses, setResponses] = useState<{
    gpt41: string | null;
    gpt4o: string | null;
  }>({
    gpt41: null,
    gpt4o: null,
  });

  const gpt41Hook = useOpenAI({
    model: "ft:gpt-4.1-2025-04-14:aqualabs::BYqfJkmU",
    onSuccess: (data) => {
      setResponses((prev) => ({
        ...prev,
        gpt41: data.output[0]?.content[0]?.text || "No response",
      }));
    },
    onError: (error) => {
      console.error("GPT-4.1 Error:", error);
      setResponses((prev) => ({
        ...prev,
        gpt41: "Error fetching response",
      }));
    },
  });

  const gpt4oHook = useOpenAI({
    model: "ft:gpt-4o-2024-08-06:aqualabs::BYqY3vsH",
    onSuccess: (data) => {
      setResponses((prev) => ({
        ...prev,
        gpt4o: data.output[0]?.content[0]?.text || "No response",
      }));
    },
    onError: (error) => {
      console.error("GPT-4o Error:", error);
      setResponses((prev) => ({
        ...prev,
        gpt4o: "Error fetching response",
      }));
    },
  });

  const isLoading = gpt41Hook.isPending || gpt4oHook.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setResponses({ gpt41: null, gpt4o: null });

    // Call both models simultaneously
    gpt41Hook.mutate(input);
    gpt4oHook.mutate(input);
  };

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
          Ask SuperiaAI anything, and see responses from both versions of the
          model.
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Ask Superiaanything..."
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
                "Ask Sage"
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-sm mb-2 text-foreground/70">
                GPT-4.1 (400 questions)
              </h3>
              <div className="min-h-32 text-foreground/90">
                {gpt41Hook.isPending ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-5 w-5 animate-spin text-foreground/50" />
                  </div>
                ) : responses.gpt41 ? (
                  <p className="whitespace-pre-wrap">{responses.gpt41}</p>
                ) : (
                  <p className="text-foreground/50 italic text-center">
                    Response will appear here
                  </p>
                )}
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-sm mb-2 text-foreground/70">
                GPT-4o (400 questions)
              </h3>
              <div className="min-h-32 text-foreground/90">
                {gpt4oHook.isPending ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-5 w-5 animate-spin text-foreground/50" />
                  </div>
                ) : responses.gpt4o ? (
                  <p className="whitespace-pre-wrap">{responses.gpt4o}</p>
                ) : (
                  <p className="text-foreground/50 italic text-center">
                    Response will appear here
                  </p>
                )}
              </div>
            </div>
          </div>
        </form>
      </main>

      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <h3 className="text-sm text-foreground/60">
          <span>SuperiaAI</span> All rights reserved. copyright &copy;{" "}
          {new Date().getFullYear()}
        </h3>
      </footer>
    </div>
  );
}

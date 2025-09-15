import React from "react";
import { useMutation } from "@tanstack/react-query";

// OpenAI Assistants API response types
interface OpenAIMessage {
  id: string;
  object: "thread.message";
  created_at: number;
  assistant_id: string | null;
  thread_id: string;
  run_id: string | null;
  role: "user" | "assistant";
  content: Array<{
    type: "text";
    text: {
      value: string;
      annotations: unknown[];
    };
  }>;
  metadata: Record<string, unknown>;
}

interface OpenAIThread {
  id: string;
  object: "thread";
  created_at: number;
  metadata: Record<string, unknown>;
}

interface OpenAIRun {
  id: string;
  object: "thread.run";
  created_at: number;
  assistant_id: string;
  thread_id: string;
  status:
    | "queued"
    | "in_progress"
    | "requires_action"
    | "cancelling"
    | "cancelled"
    | "failed"
    | "completed"
    | "expired";
  started_at: number | null;
  expires_at: number | null;
  cancelled_at: number | null;
  failed_at: number | null;
  completed_at: number | null;
  required_action: unknown | null;
  last_error: unknown | null;
  model: string;
  instructions: string | null;
  tools: unknown[];
  metadata: Record<string, unknown>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null;
  temperature: number | null;
  top_p: number | null;
  max_prompt_tokens: number | null;
  max_completion_tokens: number | null;
  truncation_strategy: unknown;
  incomplete_details: unknown | null;
}

interface OpenAIAssistantResponse {
  thread: OpenAIThread;
  message: OpenAIMessage;
  run: OpenAIRun;
  assistantMessage: string;
}

interface OpenAIAssistantRequestPayload {
  message: string;
  assistantId: string;
  threadId?: string;
  instructions?: string;
  temperature?: number;
}

// Define the hook parameters
interface UseOpenAIAssistantOptions {
  isCharacter?: boolean;
  name?: string;
  onSuccess?: (data: OpenAIAssistantResponse) => void;
  onError?: (error: Error) => void;
}

export function useOpenAIAssistant({
  onSuccess,
  onError,
}: UseOpenAIAssistantOptions = {}) {
  const fetchAssistantResponse = async (
    payload: OpenAIAssistantRequestPayload
  ): Promise<OpenAIAssistantResponse> => {
    const key = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? "";

    if (!key) {
      throw new Error(
        "OpenAI API key is required. Provide it as an option or set NEXT_PUBLIC_OPENAI_API_KEY environment variable."
      );
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "OpenAI-Beta": "assistants=v2",
    };

    let threadId = payload.threadId;

    // Step 1: Create a new thread if one doesn't exist
    if (!threadId) {
      const threadResponse = await fetch("https://api.openai.com/v1/threads", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });

      if (!threadResponse.ok) {
        const errorData = await threadResponse.json();
        throw new Error(
          errorData.error?.message ||
            `Thread creation failed with status ${threadResponse.status}`
        );
      }

      const thread: OpenAIThread = await threadResponse.json();
      threadId = thread.id;
    }

    // Step 2: Add the user message to the thread
    const messageResponse = await fetch(
      `https://api.openai.com/v1/threads${threadId}/messages`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          role: "user",
          content: payload.message,
        }),
      }
    );

    if (!messageResponse.ok) {
      const errorData = await messageResponse.json();
      throw new Error(
        errorData.error?.message ||
          `Message creation failed with status ${messageResponse.status}`
      );
    }

    const userMessage: OpenAIMessage = await messageResponse.json();

    // Step 3: Create and run the assistant
    const instructions =
      "You are an AI trained to answer questions strictly and only using the uploaded novel Superia stored in the connected vector database.Core rules: Always search the vector store for relevant excerpts before answering. If relevant text is found, base your answer entirely on it — do not invent, guess, or alter facts. If no relevant text is found, say: The novel Superia does not provide information about this. Preserve the novel’s tone,narrative style, and terminology in every response. When possible, include short, direct quotes from the source to support answers.Do not add new characters, events, locations, or lore not present in the novel. All facts, dialogue, and descriptions must be consistent with the novel’s canon.";

    const runResponse = await fetch(
      `https://api.openai.com/v1/threads${threadId}/runs`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          assistant_id: payload.assistantId,
          instructions: payload.instructions || instructions,
          temperature: payload.temperature || 0.7,
        }),
      }
    );

    if (!runResponse.ok) {
      const errorData = await runResponse.json();
      throw new Error(
        errorData.error?.message ||
          `Run creation failed with status ${runResponse.status}`
      );
    }

    let run: OpenAIRun = await runResponse.json();

    // Step 4: Poll the run until completion
    while (run.status === "queued" || run.status === "in_progress") {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

      const runStatusResponse = await fetch(
        `https://api.openai.com/v1/threads${threadId}/runs/${run.id}`,
        {
          method: "GET",
          headers,
        }
      );

      if (!runStatusResponse.ok) {
        const errorData = await runStatusResponse.json();
        throw new Error(
          errorData.error?.message ||
            `Run status check failed with status ${runStatusResponse.status}`
        );
      }

      run = await runStatusResponse.json();
    }

    if (run.status !== "completed") {
      throw new Error(
        `Run failed with status: ${run.status}. Error: ${
          (run.last_error as { message?: string })?.message || "Unknown error"
        }`
      );
    }

    // Step 5: Retrieve the assistant's response
    const messagesResponse = await fetch(
      `https://api.openai.com/v1/threads${threadId}/messages`,
      {
        method: "GET",
        headers,
      }
    );

    if (!messagesResponse.ok) {
      const errorData = await messagesResponse.json();
      throw new Error(
        errorData.error?.message ||
          `Messages retrieval failed with status ${messagesResponse.status}`
      );
    }

    const messagesData = await messagesResponse.json();
    const messages: OpenAIMessage[] = messagesData.data;

    // Get the latest assistant message
    const assistantMessage = messages.find(
      (msg) => msg.role === "assistant" && msg.run_id === run.id
    );

    if (!assistantMessage) {
      throw new Error("No assistant message found in the response");
    }

    const assistantText = assistantMessage.content
      .filter((content) => content.type === "text")
      .map((content) => content.text.value)
      .join("\n");

    return {
      thread: {
        id: threadId,
        object: "thread",
        created_at: Date.now(),
        metadata: {},
      },
      message: userMessage,
      run,
      assistantMessage: assistantText,
    };
  };

  return useMutation({
    mutationFn: fetchAssistantResponse,
    onSuccess,
    onError,
  });
}

// Helper hook for managing thread state
export function useAssistantThread() {
  const [threadId, setThreadId] = React.useState<string | null>(null);

  const createMessage = (
    assistantId: string,
    message: string,
    options?: {
      instructions?: string;
      temperature?: number;
    }
  ) => ({
    assistantId,
    message,
    threadId: threadId || undefined,
    ...options,
  });

  return {
    threadId,
    setThreadId,
    createMessage,
  };
}

import { useMutation } from "@tanstack/react-query";

// OpenAI response types
interface OpenAIOutputText {
  type: "output_text";
  text: string;
}

interface OpenAIMessage {
  id: string;
  type: "message";
  status: "completed" | string;
  content: OpenAIOutputText[];
  role: "assistant" | string;
}

interface OpenAIResponse {
  id: string;
  object: "response";
  created_at: number;
  status: "completed" | string;
  error: null | string;
  model: string;
  output: OpenAIMessage[];
  usage: {
    input_tokens: number;
    input_tokens_details: {
      cached_tokens: number;
    };
    output_tokens: number;
    output_tokens_details: {
      reasoning_tokens: number;
    };
    total_tokens: number;
  };
  temperature: number;
  top_p: number;
  truncation: string;
  parallel_tool_calls: boolean;
  service_tier: string;
  store: boolean;
  text: {
    format: {
      type: string;
    };
  };
  tool_choice: string;
  user: null | string;
}

interface OpenAIRequestPayload {
  model: string;
  input: string;
}

// Define the hook parameters
interface UseOpenAIOptions {
  model?: string;
  onSuccess?: (data: OpenAIResponse) => void;
  onError?: (error: Error) => void;
}

export function useOpenAI({
  model = "ft:gpt-4.1-nano-2025-04-14:openai::BTz2REMH",
  onSuccess,
  onError,
}: UseOpenAIOptions = {}) {
  const fetchOpenAIResponse = async (
    input: string
  ): Promise<OpenAIResponse> => {
    const key = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? "";

    if (!key) {
      throw new Error(
        "OpenAI API key is required. Provide it as an option or set NEXT_PUBLIC_OPENAI_API_KEY environment variable."
      );
    }

    const payload: OpenAIRequestPayload = {
      model,
      input,
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error?.message ||
          `API request failed with status ${response.status}`
      );
    }

    return response.json();
  };

  return useMutation({
    mutationFn: fetchOpenAIResponse,
    onSuccess,
    onError,
  });
}

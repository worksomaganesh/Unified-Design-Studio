import type { AIProviderAdapter, AIProviderId, ProviderImage, ProviderRequest } from "@uds/ai-engine";

type ProviderJson = Record<string, any>;
const imagePart = (image: ProviderImage) => ({ mimeType: image.mimeType, data: image.base64 });

async function readJson(response: Response): Promise<ProviderJson> {
  return response.json().catch(() => ({})) as Promise<ProviderJson>;
}

function outputText(provider: AIProviderId, data: ProviderJson): string {
  let text = "";
  if (provider === "openai") {
    if (typeof data.output_text === "string") text = data.output_text;
    else text = (data.output ?? []).flatMap((item: ProviderJson) => item.type === "message" ? item.content ?? [] : []).filter((item: ProviderJson) => item.type === "output_text").map((item: ProviderJson) => item.text ?? "").join("\n");
  } else if (provider === "anthropic") {
    text = (data.content ?? []).filter((item: ProviderJson) => item.type === "text").map((item: ProviderJson) => item.text ?? "").join("\n");
  } else {
    text = (data.candidates?.[0]?.content?.parts ?? []).filter((item: ProviderJson) => typeof item.text === "string").map((item: ProviderJson) => item.text).join("\n");
  }
  if (!text.trim()) throw new Error("The provider returned no usable text. Check the model's response and safety settings.");
  return text.trim();
}

async function postJson(provider: AIProviderId, url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal): Promise<ProviderJson> {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: signal ?? AbortSignal.timeout(120_000) });
  } catch (error) {
    if ((error as Error).name === "AbortError" || (error as Error).name === "TimeoutError") throw new Error("The AI provider request timed out. Try a shorter brief or fewer screens.");
    throw new Error("Could not connect to the selected AI provider. Check network access from the local service.");
  }
  const data = await readJson(response);
  if (!response.ok) {
    const providerMessage = typeof data.error?.message === "string" ? data.error.message : typeof data.message === "string" ? data.message : "";
    const hint = providerMessage.length ? ` ${providerMessage.slice(0, 220)}` : "";
    throw new Error(`${provider} request failed (HTTP ${response.status}).${hint}`);
  }
  return data;
}

export const providerAdapters: Record<AIProviderId, AIProviderAdapter> = {
  openai: {
    id: "openai", label: "OpenAI",
    capability: { imageInput: true, jsonOutput: "valid-json", streaming: false, maxImages: 3 },
    async generate(request, apiKey) {
      const content = [
        { type: "input_text", text: `${request.instruction}\n\n${request.prompt}\n\nRespond with JSON only.` },
        ...request.images.map(image => ({ type: "input_image", image_url: `data:${image.mimeType};base64,${image.base64}` })),
      ];
      const data = await postJson("openai", "https://api.openai.com/v1/responses", { authorization: `Bearer ${apiKey}` }, {
        model: request.model,
        store: false,
        max_output_tokens: 8192,
        input: [{ role: "user", content }],
        text: { format: { type: "json_object" } },
      }, request.signal);
      return outputText("openai", data);
    },
  },
  anthropic: {
    id: "anthropic", label: "Anthropic",
    capability: { imageInput: true, jsonOutput: "prompt-guided", streaming: false, maxImages: 3 },
    async generate(request, apiKey) {
      const content = [
        ...request.images.flatMap(image => [
          { type: "text", text: `Reference image: ${image.name}` },
          { type: "image", source: { type: "base64", media_type: image.mimeType, data: image.base64 } },
        ]),
        { type: "text", text: `${request.instruction}\n\n${request.prompt}\n\nRespond with JSON only.` },
      ];
      const data = await postJson("anthropic", "https://api.anthropic.com/v1/messages", {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      }, { model: request.model, max_tokens: 8192, messages: [{ role: "user", content }] }, request.signal);
      return outputText("anthropic", data);
    },
  },
  google: {
    id: "google", label: "Google Gemini",
    capability: { imageInput: true, jsonOutput: "valid-json", streaming: false, maxImages: 3 },
    async generate(request, apiKey) {
      const contents = [
        ...request.images.map(image => ({ inlineData: imagePart(image) })),
        { text: `${request.instruction}\n\n${request.prompt}\n\nRespond with JSON only.` },
      ];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent`;
      const data = await postJson("google", url, { "x-goog-api-key": apiKey }, {
        contents: [{ role: "user", parts: contents }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 },
      }, request.signal);
      return outputText("google", data);
    },
  },
};

const modelEnvironmentKeys: Record<AIProviderId, string> = {
  openai: "UDS_OPENAI_MODEL",
  anthropic: "UDS_ANTHROPIC_MODEL",
  google: "UDS_GOOGLE_MODEL",
};
export function providerDefaultModel(provider: AIProviderId): string { return process.env[modelEnvironmentKeys[provider]]?.trim() ?? ""; }

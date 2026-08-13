import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  query: z.string().min(1).max(200),
  items: z.array(z.object({ id: z.string(), text: z.string().max(300) })).max(300),
});

export type SearchMatch = { id: string; why: string };
export type SmartSearchResult = { matches: SearchMatch[]; suggestions: string[] };

const EMPTY: SmartSearchResult = { matches: [], suggestions: [] };

/** Describe what you want in plain words and the model picks the matching items. */
export const smartSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }): Promise<SmartSearchResult> => {
    // only approved staff may spend the shop's AI budget
    const { data: approved, error: approvalError } = await context.supabase.rpc("is_approved", {
      _user_id: context.userId,
    });
    if (approvalError || !approved) throw new Error("Forbidden");

    const key = process.env["LOVABLE_API_KEY"];
    if (!key || data.items.length === 0) return EMPTY;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        stream: true,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  `A shopper describes what they want: "${data.query}".\n` +
                  `Pick every matching item id from this catalogue. For each match add "why": a short lowercase reason (max 8 words) explaining the match.\n` +
                  `Also return up to 5 "suggestions": short lowercase search phrases a shopper could type next for this catalogue.\n` +
                  `Answer with json only.\n` +
                  data.items.map((i) => `${i.id} :: ${i.text}`).join("\n"),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "matches",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                matches: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: { id: { type: "string" }, why: { type: "string" } },
                    required: ["id", "why"],
                  },
                },
                suggestions: { type: "array", items: { type: "string" } },
              },
              required: ["matches", "suggestions"],
            },
          },
        },
      }),
    });

    if (!res.ok || !res.body) return EMPTY;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload) as { type?: string; delta?: string };
          if (evt.type === "response.output_text.delta" && evt.delta) text += evt.delta;
        } catch {
          /* skip partial frames */
        }
      }
    }

    try {
      const parsed = JSON.parse(text) as Partial<SmartSearchResult>;
      return {
        matches: Array.isArray(parsed.matches) ? parsed.matches.slice(0, 60) : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : [],
      };
    } catch {
      return EMPTY;
    }
  });

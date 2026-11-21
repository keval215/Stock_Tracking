import { GoogleGenAI } from '@google/genai';
import type { GroundedSource, StockResearchResponse } from '../src/shared/types';

const cache = new Map<string, { expiresAt: number; data: StockResearchResponse }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.',
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function researchIndianStock(
  symbol: string,
  companyName: string,
  closePrice: number,
  changePct: number,
  tradeDate: string,
): Promise<StockResearchResponse> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const cached = cache.get(cleanSymbol);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const ai = getClient();
  const prompt = `Search for the latest verified news, quarterly earnings, corporate actions, brokerage commentary, and sector catalysts for Indian NSE stock ${cleanSymbol} (${companyName}). Reference price as of ${tradeDate} close: INR ${closePrice.toFixed(2)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%). Summarize the 3-4 most relevant recent developments in concise bullet points for an equity trader.`;

  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are an Indian equity market research analyst covering NSE-listed companies. Be factual, concise (under 180 words), and base statements strictly on current Google Search findings. Use plain bullet points with clear dates where available. Do not invent price targets or fabricate numbers.',
        tools: [{ googleSearch: {} }],
      },
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Unable to query Google Search grounding.';
    try {
      const parsed = JSON.parse(raw) as { error?: { code?: number; message?: string } };
      if (parsed?.error?.message) {
        const cleanMsg = parsed.error.message.replace(/\s+/g, ' ').trim();
        throw new Error(cleanMsg);
      }
    } catch (parseErr) {
      if (parseErr instanceof Error && parseErr.message !== raw && !raw.trim().startsWith('{')) {
        throw parseErr;
      }
      if (parseErr instanceof Error && raw.trim().startsWith('{') && parseErr.name !== 'SyntaxError') {
        throw parseErr;
      }
    }
    throw new Error(raw);
  }

  const summary = (response.text || '').trim();
  if (!summary) {
    throw new Error('No research summary was returned for this symbol.');
  }

  const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seenUris = new Set<string>();
  const sources: GroundedSource[] = [];

  for (const chunk of rawChunks) {
    const uri = chunk.web?.uri;
    const title = chunk.web?.title;
    if (!uri || seenUris.has(uri)) continue;
    seenUris.add(uri);
    sources.push({
      uri,
      title: title || new URL(uri).hostname,
    });
  }

  const result: StockResearchResponse = {
    symbol: cleanSymbol,
    summary,
    sources: sources.slice(0, 6),
    generatedAt: new Date().toISOString(),
  };

  cache.set(cleanSymbol, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    data: result,
  });

  return result;
}

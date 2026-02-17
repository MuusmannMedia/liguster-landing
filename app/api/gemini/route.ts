import { NextResponse } from 'next/server';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 15;

const rateLimiter = new Map<string, { count: number; expiresAt: number }>();

type GeminiPart = { text?: string };
type GeminiCandidate = { content?: { parts?: GeminiPart[] } };
type GeminiResponse = {
  candidates?: GeminiCandidate[];
  error?: { message?: string };
};

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return request.headers.get('x-real-ip') || 'unknown';
}

function isRateLimited(key: string) {
  const now = Date.now();
  const entry = rateLimiter.get(key);

  if (!entry || now > entry.expiresAt) {
    rateLimiter.set(key, {
      count: 1,
      expiresAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count += 1;
  return false;
}

function extractText(data: GeminiResponse) {
  const firstCandidate = data.candidates?.[0];
  const firstPart = firstCandidate?.content?.parts?.[0];
  return firstPart?.text?.trim() || '';
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);

  if (isRateLimited(clientIp)) {
    return NextResponse.json(
      { error: 'For mange forespørgsler. Prøv igen om et øjeblik.' },
      { status: 429 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key mangler server-konfiguration' },
      { status: 500 }
    );
  }

  let prompt = '';

  try {
    const body = await request.json();
    prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  } catch {
    return NextResponse.json(
      { error: 'Ugyldig JSON i request body' },
      { status: 400 }
    );
  }

  if (!prompt) {
    return NextResponse.json(
      { error: 'Prompt må ikke være tom' },
      { status: 400 }
    );
  }

  if (prompt.length > 4000) {
    return NextResponse.json(
      { error: 'Prompt er for lang (maks 4000 tegn)' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        signal: AbortSignal.timeout(12_000),
      }
    );

    const data = (await response.json()) as GeminiResponse;

    if (!response.ok) {
      const message = data.error?.message || 'Gemini svarede med en fejl';
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const text = extractText(data);

    if (!text) {
      return NextResponse.json(
        { error: 'Gemini returnerede ikke et gyldigt svar' },
        { status: 502 }
      );
    }

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json(
      { error: 'Kunne ikke hente svar fra Gemini lige nu. Prøv igen.' },
      { status: 502 }
    );
  }
}

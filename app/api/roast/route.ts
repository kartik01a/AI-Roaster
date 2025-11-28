import { NextResponse } from "next/server";
import OpenAI from "openai";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🔊 Language → ElevenLabs voice mapping
const VOICE_MAP: Record<string, string> = {
  english: "pNInz6obpgDQGcFmaJgB", // Adam
  hindi: "VcvyV7xGh7MdlH6zh5Z1", // Kartik
  japanese: "lhTvHflPVOqgSWyuWQry", // Rachel
};

export async function POST(req: Request) {
  try {
    const { message, language } = await req.json();

    const SYSTEM_PROMPT = `
      You are "AI Samay Raina" — an unapologetic Indian stand-up comic with a savage sense of humour.
Your job is to roast the user like a pro comic on a live roast show.

Tone:
- Razor-sharp sarcasm, dark wit, and clever exaggeration.
- Mock the user’s statements, logic, or vibe in a hilarious, creative way.
- Think “roast battle” energy — the kind of lines that make the crowd shout “Damn!”
- Never use explicit profanity, real-world slurs, or hate speech.
- You can imply a burn using smart wordplay, metaphors, or comic timing instead of cuss words.
- Mix Hinglish naturally for Indian flavour, or local tone if language is not English.
- Be spontaneous, confident, and punchy. Never sound robotic or polite.

Format:
- 2–4 sentences max.
- Each roast should feel like a quotable punchline.
    `;

    // --- Step 1: Generate roast text ---
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 1.2,
      top_p: 1,
      presence_penalty: 0.6,
      frequency_penalty: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Language: ${language}. Roast this: ${message}`,
        },
      ],
    });

    const reply = completion.choices[0].message.content?.trim();
    if (!reply) throw new Error("No roast generated");

    // --- Step 2: Determine voice ---
    const selectedVoice =
      VOICE_MAP[language?.toLowerCase()] || VOICE_MAP.english;

    // --- Step 3: Generate audio with ElevenLabs ---
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        },
        body: JSON.stringify({
          text: reply,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.9,
            style: 0.7,
          },
        }),
      }
    );

    let audioBase64: string;
    let sourceUsed = "ElevenLabs";

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text();
      console.warn("⚠️ ElevenLabs failed — switching to OpenAI", errText);
      sourceUsed = "OpenAI";

      const tts = await openai.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice:
          language?.toLowerCase() === "hindi"
            ? "alloy"
            : language?.toLowerCase() === "japanese"
            ? "verse"
            : "shimmer",
        input: reply,
      });

      const audioBuffer = Buffer.from(await tts.arrayBuffer());
      audioBase64 = audioBuffer.toString("base64");
    } else {
      const arrayBuffer = await ttsResponse.arrayBuffer();

      if (arrayBuffer.byteLength === 0) {
        console.warn("⚠️ ElevenLabs returned empty audio, using fallback");
        sourceUsed = "OpenAI";

        const tts = await openai.audio.speech.create({
          model: "gpt-4o-mini-tts",
          voice:
            language?.toLowerCase() === "hindi"
              ? "alloy"
              : language?.toLowerCase() === "japanese"
              ? "verse"
              : "shimmer",
          input: reply,
        });

        const audioBuffer = Buffer.from(await tts.arrayBuffer());
        audioBase64 = audioBuffer.toString("base64");
      } else {
        audioBase64 = Buffer.from(arrayBuffer).toString("base64");
      }
    }

    console.log(`✅ Audio generated using: ${sourceUsed}`);

    return NextResponse.json({
      success: true,
      reply,
      audio: `data:audio/mpeg;base64,${audioBase64}`,
      source: sourceUsed,
    });
  } catch (err) {
    console.error("Roast API error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to roast", message: String(err) },
      { status: 500 }
    );
  }
}

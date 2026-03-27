const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/transcript", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "No URL provided" });

  try {
    const videoId = extractVideoId(url);
    if (!videoId) return res.status(400).json({ error: "Could not read video ID from that URL" });

    const { YoutubeTranscript } = require("youtube-transcript");
    const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcriptData || transcriptData.length === 0) {
      return res.status(404).json({ error: "No transcript found. Make sure the video has captions enabled." });
    }

    const transcript = transcriptData
      .map(item => {
        const minutes = Math.floor(item.offset / 60000);
        const seconds = Math.floor((item.offset % 60000) / 1000);
        return `[${minutes}:${seconds.toString().padStart(2, "0")}] ${item.text}`;
      })
      .join("\n");

    res.json({ transcript, videoId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch transcript: " + err.message });
  }
});

app.post("/analyze", async (req, res) => {
  const { transcript, videoTitle } = req.body;
  if (!transcript) return res.status(400).json({ error: "No transcript provided" });

  try {
    const prompt = `You are a professional clip editor for DrDonut, a popular Minecraft/gaming streamer. Analyze this stream transcript and find the 6-8 best moments to clip for TikTok and YouTube Shorts.

For each clip give:
- timestamp: when it happens (MM:SS format)
- title: punchy clip title, max 6 words, no quotes
- type: one of: hype, funny, reaction, clutch, highlight, informative, drama
- reason: one sentence on why this performs well as a clip
- hook: the first line someone would see that makes them stop scrolling (max 8 words)
- caption: bold on-screen text overlay for the clip, short and punchy, max 5 words, ALL CAPS

${videoTitle ? `Stream title: ${videoTitle}` : ""}

Transcript:
${transcript.slice(0, 8000)}

Respond ONLY with valid JSON, no markdown, no backticks:
{"clips":[{"timestamp":"1:23","title":"Title here","type":"funny","reason":"Why this clips well.","hook":"Hook line here.","caption":"ON SCREEN TEXT"}]}`;

    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content.map((b) => b.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to analyze: " + err.message });
  }
});

function extractVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    return null;
  } catch { return null; }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`DrDonut Clipper running on port ${PORT}`));

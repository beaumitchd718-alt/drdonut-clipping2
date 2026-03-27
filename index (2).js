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

app.post("/analyze", async (req, res) => {
  const { transcript, videoTitle } = req.body;

  if (!transcript) {
    return res.status(400).json({ error: "No transcript provided" });
  }

  try {
    const prompt = `You are a professional clip editor for DrDonut, a popular Minecraft/gaming streamer. Analyze this stream transcript and find the 6-8 best moments to clip for TikTok, YouTube Shorts, or Twitter.

For each clip give:
- timestamp: when it happens (MM:SS format)
- title: punchy clip title, max 6 words
- type: one of: hype, funny, reaction, clutch, highlight, informative, drama
- reason: one sentence on why this performs well as a clip
- hook: the first line someone would see/hear that makes them stop scrolling

${videoTitle ? `Stream title: ${videoTitle}` : ""}

Transcript:
${transcript.slice(0, 6000)}

Respond ONLY with valid JSON, no markdown, no backticks:
{"clips":[{"timestamp":"1:23","title":"Title here","type":"funny","reason":"Why this clips well.","hook":"Opening line that hooks viewers."}]}`;

    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content.map((b) => b.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to analyze transcript: " + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`DrDonut Clipper running on port ${PORT}`));

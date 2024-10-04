import axios from "axios";

export default async function handler(req, res) {
  const apiKey = process.env.ELEVEN_LABS_API_KEY;
  const baseUrl = "https://api.elevenlabs.io/v1/text-to-speech";
  const headers = {
    "Content-Type": "application/json",
    "xi-api-key": apiKey,
    "Accept": "audio/mpeg", // Request audio/mpeg format
  };

  const requestBody = {
    text: req.body.text,
    voice_settings: req.body.voice_settings || {
      stability: 1,
      similarity_boost: 1,
    },
  };

  try {
    const response = await axios.post(`${baseUrl}/${req.body.voiceId}`, requestBody, {
      headers,
      responseType: "arraybuffer", // Change responseType to 'arraybuffer'
    });

    // Set the appropriate content type for the response
    res.setHeader('Content-Type', 'audio/mpeg');
    res.status(200).send(Buffer.from(response.data, 'binary'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: `Error: Unable to stream audio. Details: ${error.message}` });
  }
}

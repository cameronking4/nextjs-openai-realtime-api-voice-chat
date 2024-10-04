import OpenAI from "openai";

export default async function handler(req, res) {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        const response = await openai.models.list();
        res.status(200).json({ message: "API key is valid", models: response.data });
    } catch (error) {
        console.error("OpenAI API error:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Failed to validate API key", details: error.message });
    }
}
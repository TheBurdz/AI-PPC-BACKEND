const express = require('express');
const axios = require('axios');
const cors = require("cors");

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000; // Default to port 10000 if not set

app.use(cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));

app.use(express.json()); // Ensure JSON body parsing

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
let userThreads = {}; // Stores threadId per user

app.post("/create-thread", async (req, res) => {
    try {
        const threadResponse = await axios.post(
            "https://api.openai.com/v1/threads",
            {},
            { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
        );
        const threadId = threadResponse.data.id;
        res.json({ threadId });
    } catch (error) {
        console.error("Error creating thread:", error);
        res.status(500).json({ error: "Failed to create thread" });
    }
});

app.post("/analyze-ppc", async (req, res) => {
    try {
        const { userId, summary } = req.body;

        if (!userThreads[userId]) {
            console.log("🆕 New user detected, creating thread...");
            const threadResponse = await axios.post(
                "https://api.openai.com/v1/threads",
                {},
                { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
            );
            userThreads[userId] = threadResponse.data.id;
        }

        const threadId = userThreads[userId];

        await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            { role: "user", content: `Analyze this PPC campaign data: ${JSON.stringify(summary)}` },
            { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
        );

        const runResponse = await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/runs`,
            { assistant_id: "asst_fpGZKkTQYwZ94o0DxGAm89mo" },
            { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
        );

        let runId = runResponse.data.id;
        let runStatus = "in_progress";

        while (runStatus === "in_progress") {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const statusResponse = await axios.get(
                `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
                { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
            );
            runStatus = statusResponse.data.status;
        }

        const messagesResponse = await axios.get(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
        );

        const aiMessages = messagesResponse.data.data
            .filter(msg => msg.role === "assistant")
            .map(msg => msg.content)
            .flat();

        const aiTextResponses = aiMessages.map(content => {
            return content.text?.value || "";
        }).join("\n");

        res.json({ insights: aiTextResponses });

    } catch (error) {
        console.error("❌ Error in AI Processing:", error);
        res.status(500).json({ error: "AI processing failed." });
    }
});

app.post("/chat", async (req, res) => {
    try {
        const { threadId, userMessage } = req.body;

        await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            { role: "user", content: userMessage },
            { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
        );

        const runResponse = await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/runs`,
            { assistant_id: "asst_fpGZKkTQYwZ94o0DxGAm89mo" },
            { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
        );

        let runId = runResponse.data.id;
        let runStatus = "in_progress";

        while (runStatus === "in_progress") {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const statusResponse = await axios.get(
                `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
                { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
            );
            runStatus = statusResponse.data.status;
        }

        const messagesResponse = await axios.get(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
        );

        const aiMessages = messagesResponse.data.data
            .filter(msg => msg.role === "assistant")
            .map(msg => msg.content)
            .flat();

        const aiTextResponses = aiMessages.map(content => {
            return content.text?.value || "";
        }).join("\n");

        res.json({ insights: aiTextResponses });

    } catch (error) {
        console.error("❌ Error in AI Chat Processing:", error);
        res.status(500).json({ error: "AI chat processing failed." });
    }
});

app.listen(3000, () => console.log("🚀 Server running on port 3000"));




// ✅ Step 6: Start the server
app.listen(PORT, () => {
    console.log(`✅ AI PPC Backend is running on port ${PORT}`);
});

// 🔹 AI Chat Processing Function
async function processChat(userMessage) {
    try {
        const response = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-4",  // Adjust based on your AI model
            messages: [{ role: "user", content: userMessage }],
            max_tokens: 100
        }, {
            headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }
        });

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("❌ AI API Error:", error.response?.data || error.message);
        return "⚠️ AI failed to process your request. Please try again later.";
    }
}

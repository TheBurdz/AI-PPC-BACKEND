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

app.post("/chat", async (req, res) => {
    try {
        const userMessage = req.body.userMessage;
        console.log(`💬 Received user message: "${userMessage}"`);

        const aiResponse = await processChat(userMessage);
        console.log(`🧠 AI Response: "${aiResponse}"`);

        res.json({ response: aiResponse });
    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


const conversationThreads = {}; // Store thread IDs by user session

app.post('/analyze-ppc', async (req, res) => {
    try {
        const { userId, summary } = req.body;

        if (!userId || !summary) {
            return res.status(400).json({ error: "Missing required data." });
        }

        console.log("📡 Received PPC Data for Analysis:", JSON.stringify(summary, null, 2));

        // 🧠 Send data to OpenAI Assistant
        const threadResponse = await axios.post(
            'https://api.openai.com/v1/threads',
            {},
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2"
                }
            }
        );
        const threadId = threadResponse.data.id;
        console.log("🧵 Created AI Thread:", threadId);

        await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            {
                role: "user",
                content: `You are a very advanced Amazon PPC Specialist. Possibly the best in the world. Using this supplied Amazon PPC Data provide a deep overview of the performance; calling out good and poor performance metrics and provide actionable insights:\n${JSON.stringify(summary, null, 2)}`
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2"
                }
            }
        );

        console.log("📩 AI received PPC data. Waiting for insights...");

        const runResponse = await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/runs`,
            { assistant_id: "asst_fpGZKkTQYwZ94o0DxGAm89mo" },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2"
                }
            }
        );

        const runId = runResponse.data.id;
        console.log("🚀 AI Processing Started:", runId);

        // 🔄 Poll for AI response
        let runStatus = "in_progress";
        while (runStatus === "in_progress") {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 sec
            const statusResponse = await axios.get(
                `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
                {
                    headers: {
                        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                        "Content-Type": "application/json",
                        "OpenAI-Beta": "assistants=v2"
                    }
                }
            );
            runStatus = statusResponse.data.status;
        }

        console.log("📥 AI Processing Complete. Retrieving Insights...");

        // Get AI messages
        const messagesResponse = await axios.get(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2"
                }
            }
        );

        const aiMessages = messagesResponse.data.data
            .filter(msg => msg.role === "assistant")
            .map(msg => msg.content)
            .flat(); // Flatten responses

        const aiTextResponses = aiMessages.map(content => {
            if (Array.isArray(content)) {
                return content.map(c => c.text?.value || "").join("\n");
            }
            return content.text?.value || "";
        }).join("\n");

        console.log("💡 AI Insights:", aiTextResponses);

        res.json({ insights: aiTextResponses });

    } catch (error) {
        console.error("❌ AI Processing Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "AI processing failed.", details: error.response ? error.response.data : error.message });
    }
});





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

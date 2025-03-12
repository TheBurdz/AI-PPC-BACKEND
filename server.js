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

app.post('/chat', async (req, res) => {
    try {
        const { userId, userMessage } = req.body;

        if (!userId || !userMessage) {
            return res.status(400).json({ error: "Missing userId or userMessage" });
        }

        // Retrieve the existing thread ID
        const threadId = conversationThreads[userId];

        if (!threadId) {
            return res.status(400).json({ error: "No active thread. Start with PPC analysis first." });
        }

        // Add user message to the existing thread
        await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            {
                role: "user",
                content: userMessage
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2"
                }
            }
        );

        // Run the Assistant again
        const runResponse = await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/runs`,
            {
                assistant_id: "asst_fpGZKkTQYwZ94o0DxGAm89mo"
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2"
                }
            }
        );

        const runId = runResponse.data.id;

        // Poll for completion
        let runStatus = "in_progress";
        while (runStatus === "in_progress") {
            await new Promise(resolve => setTimeout(resolve, 2000));
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

        // Retrieve messages from the thread
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

        // Extract AI response
        const aiMessages = messagesResponse.data.data
            .filter(msg => msg.role === "assistant")
            .map(msg => msg.content)
            .flat();

        const aiTextResponses = aiMessages.map(content => {
            if (Array.isArray(content)) {
                return content.map(c => c.text?.value || "").join("\n");
            }
            return content.text?.value || "";
        }).join("\n");

        res.json({ response: aiTextResponses });

    } catch (error) {
        console.error("❌ Error in Chat Processing:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "AI chat processing failed.", details: error.response ? error.response.data : error.message });
    }
});



const conversationThreads = {}; // Store thread IDs by user session

app.post('/analyze-ppc', async (req, res) => {
    try {
        console.log("📩 Received API Request:", JSON.stringify(req.body, null, 2)); // Log received request

        const { summary, userId } = req.body;

        if (!userId) {
            console.error("🚨 Missing userId in request!");
            return res.status(400).json({ error: "Missing userId" });
        }

        if (!summary || Object.keys(summary).length === 0) {
            console.error("🚨 Missing or empty summary data!");
            return res.status(400).json({ error: "Missing summary data" });
        }

        // Proceed with AI processing...
        res.json({ message: "Data received successfully" });

    } catch (error) {
        console.error("❌ Server Processing Error:", error);
        res.status(500).json({ error: "AI processing failed." });
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

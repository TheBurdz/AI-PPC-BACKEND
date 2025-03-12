const chatHistory = {}; // Stores conversation history per user

const userThreads = {}; // Stores OpenAI thread IDs per user

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
        const { userId, userMessage } = req.body;

        if (!userId || !userMessage) {
            return res.status(400).json({ error: "Missing userId or userMessage" });
        }

        // Retrieve user's existing thread
        const threadId = userThreads[userId];

        if (!threadId) {
            return res.status(400).json({ error: "No existing PPC data found. Analyze PPC first." });
        }

        console.log(`💬 User ${userId} Message: "${userMessage}" (Thread ID: ${threadId})`);

        // Add user's message to the existing thread
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

        // Run Assistant on the existing thread
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
        let runStatus = "in_progress";

        // Poll for AI completion
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

        // Retrieve AI Response
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
            .flat();

        const aiTextResponses = aiMessages.map(content => {
            if (Array.isArray(content)) {
                return content.map(c => c.text?.value || "").join("\n");
            }
            return content.text?.value || "";
        }).join("\n");

        res.json({ response: aiTextResponses });

    } catch (error) {
        console.error("❌ Error in AI Chat:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Chat processing failed.", details: error.response ? error.response.data : error.message });
    }
});





app.post('/analyze-ppc', async (req, res) => {
    try {
        const { userId, summary, campaigns } = req.body;

        if (!userId) {
            return res.status(400).json({ error: "Missing userId" });
        }

        // Check if user already has a thread
        let threadId = userThreads[userId];

        // If no thread exists, create a new one
        if (!threadId) {
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
            threadId = threadResponse.data.id;
            userThreads[userId] = threadId; // Save the thread ID for later use
        }

        console.log(`🧵 User ${userId} Thread ID: ${threadId}`);

        // Add PPC Data to thread (if not already added)
        await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            {
                role: "user",
                content: `Here is the PPC campaign data for analysis: ${JSON.stringify({ summary, campaigns })}`
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2"
                }
            }
        );

        // Run Assistant for initial PPC analysis
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
        let runStatus = "in_progress";

        // Poll for AI completion
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

        // Retrieve AI Response
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
            .flat();

        const aiTextResponses = aiMessages.map(content => {
            if (Array.isArray(content)) {
                return content.map(c => c.text?.value || "").join("\n");
            }
            return content.text?.value || "";
        }).join("\n");

        res.json({ insights: aiTextResponses, threadId });

    } catch (error) {
        console.error("❌ Error in AI Processing:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "AI processing failed.", details: error.response ? error.response.data : error.message });
    }
});



// ✅ Step 6: Start the server
app.listen(PORT, () => {
    console.log(`✅ AI PPC Backend is running on port ${PORT}`);
});

function storePPCData(userId, ppcData) {
    chatHistory[userId] = [
        { role: "system", content: "You are an AI PPC assistant. Here is the PPC data for reference." },
        { role: "assistant", content: `Here is the PPC Data for this session: ${JSON.stringify(ppcData)}` }
    ];
    console.log(`✅ Stored PPC Data for user ${userId}`);
}


// 🔹 AI Chat Processing Function
async function processChat(userId, userMessage) {
    try {
        // Initialize conversation history if new user
        if (!chatHistory[userId]) {
            chatHistory[userId] = [
                { role: "system", content: "You are an AI PPC assistant. Analyze PPC data and assist the user with campaign optimizations." }
            ];
        }

        // Add user's message to conversation history
        chatHistory[userId].push({ role: "user", content: userMessage });

        // Send conversation history to AI
        const response = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-4",
            messages: chatHistory[userId], // Send full conversation history
            max_tokens: 200
        }, {
            headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }
        });

        // Store AI response in conversation history
        const aiMessage = response.data.choices[0].message;
        chatHistory[userId].push(aiMessage);

        return aiMessage.content;
    } catch (error) {
        console.error("❌ AI API Error:", error.response?.data || error.message);
        return "⚠️ AI failed to process your request. Please try again later.";
    }
}


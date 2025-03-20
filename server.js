const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));

const userThreads = {}; // Stores thread IDs per user

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = "asst_fpGZKkTQYwZ94o0DxGAm89mo"; // Replace with your actual Assistant ID

app.post('/create-thread', async (req, res) => {
    try {
        const threadResponse = await axios.post(
            'https://api.openai.com/v1/threads', // OpenAI API
            {},
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2"
                }
            }
        );
        res.json({ threadId: threadResponse.data.id });
    } catch (error) {
        console.error("❌ Error creating AI thread:", error.response?.data || error.message);
        res.status(500).json({ error: "AI thread creation failed." });
    }
});


app.post("/start-thread", async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: "Missing userId" });
        }

        // Call OpenAI API to create a thread
        const threadResponse = await axios.post(
            "https://api.openai.com/v1/threads",
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
        console.log("✅ New AI thread created:", threadId);

        res.json({ threadId });

    } catch (error) {
        console.error("❌ Error creating AI thread:", error.response?.data || error.message);
        res.status(500).json({ error: "AI thread creation failed.", details: error.response?.data || error.message });
    }
});


// ✅ Analyze PPC Data (With Memory)
app.post('/analyze-ppc', async (req, res) => {
    try {
        const ppcData = req.body;

        // Step 1: Create a new thread
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
        const threadId = threadResponse.data.id; // ✅ Store thread ID

        // Step 2: Add a message to the thread
        await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            {
                role: "user",
                content: `Analyze this PPC campaign data and provide insights: ${JSON.stringify(ppcData)}`
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2"
                }
            }
        );

        // Step 3: Run the Assistant on the thread
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

        // Step 5: Retrieve Messages from the Thread
        // ✅ Retrieve Messages from OpenAI
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

// ✅ Extract Only the Latest AI Message
const aiMessages = messagesResponse.data.data.filter(msg => msg.role === "assistant");

let latestAiResponse = "No AI response available.";
if (aiMessages.length > 0) {
    const lastMessage = aiMessages[aiMessages.length - 1];

    // ✅ Extract only the text from the last response
    if (Array.isArray(lastMessage.content)) {
        latestAiResponse = lastMessage.content.map(c => c.text?.value || "").join("\n");
    } else {
        latestAiResponse = lastMessage.content.text?.value || "";
    }
}

console.log("✅ Sending Latest AI Response:", latestAiResponse);
res.json({ insights: latestAiResponse });

        // res.json({ insights: aiTextResponses, threadId });

    } catch (error) {
        console.error("❌ AI Processing Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "AI processing failed.", details: error.response ? error.response.data : error.message });
    }
});


// ✅ Handle Follow-Up Messages (Chat Feature)
app.post('/chat', async (req, res) => {
    try {
        const { threadId, userMessage, userId } = req.body;

        if (!threadId || !userMessage || !userId) {
            return res.status(400).json({ error: "Missing threadId, userMessage, or userId" });
        }

        console.log(`💬 Adding message to thread ${threadId}:`, userMessage);

        // Step 1: Add the message to the thread
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

        // Step 2: Run the Assistant on the thread
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

        // Step 3: Retrieve Messages from the Thread
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

        res.json({ insights: aiTextResponses });

    } catch (error) {
        console.error("❌ AI Processing Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "AI processing failed.", details: error.response ? error.response.data : error.message });
    }
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

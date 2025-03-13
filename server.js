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

// ✅ Analyze PPC Data (With Memory)
app.post('/analyze-ppc', async (req, res) => {
    try {
        const { userId, summary } = req.body;

        if (!userId || !summary) {
            return res.status(400).json({ error: "Missing required data." });
        }

        console.log("📡 Received PPC Data for Analysis:", JSON.stringify(summary, null, 2));

        // 🧠 Send data to OpenAI Assistant – create a new thread each time for now
        // (If you want to store and reuse a thread per user, you could store it in a userThreads object.)
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

        // Send PPC Data as a message to the thread
        await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            {
                role: "user",
                content: `You are a very advanced Amazon PPC Specialist. Using the following PPC data, provide a deep analysis with actionable insights:\n${JSON.stringify(summary, null, 2)}`
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2"
                }
            }
        );

        console.log("📩 AI received PPC data. Attempting to start an AI run...");

        let runId;
        try {
            // Try to start a new run
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
            runId = runResponse.data.id;
            console.log("🚀 AI Processing Started, new runId:", runId);
        } catch (error) {
            // If error message indicates an active run, get that run's id
            if (
                error.response &&
                error.response.data &&
                error.response.data.error &&
                error.response.data.error.message &&
                error.response.data.error.message.includes("already has an active run")
            ) {
                console.warn("⚠️ Active run already exists. Retrieving active run id...");
                const runsResponse = await axios.get(
                    `https://api.openai.com/v1/threads/${threadId}/runs`,
                    {
                        headers: {
                            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                            "Content-Type": "application/json",
                            "OpenAI-Beta": "assistants=v2"
                        }
                    }
                );
                // Find the active run in the list
                const activeRun = runsResponse.data.data.find(r => r.status === "in_progress");
                if (activeRun) {
                    runId = activeRun.id;
                    console.log("🚀 Using existing active runId:", runId);
                } else {
                    throw error;
                }
            } else {
                throw error;
            }
        }

        // Poll for AI run completion
        let runStatus = "in_progress";
        while (runStatus === "in_progress") {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
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
            console.log(`🔄 Run Status: ${runStatus}`);
        }

        console.log("📥 AI Processing Complete. Retrieving insights...");

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

        console.log("💡 AI Insights:", aiTextResponses);
        res.json({ insights: aiTextResponses });

    } catch (error) {
        console.error("❌ Error in AI Processing:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "AI processing failed.", details: error.response ? error.response.data : error.message });
    }
});


// ✅ Handle Follow-Up Messages (Chat Feature)
app.post("/chat", async (req, res) => {
    try {
        const { userId, userMessage } = req.body;

        if (!userId || !userMessage) {
            return res.status(400).json({ error: "Missing userId or userMessage." });
        }

        const threadId = userThreads[userId]; // Retrieve existing thread

        if (!threadId) {
            return res.status(400).json({ error: "No active conversation found. Start with PPC data first." });
        }

        // ✅ Add User's Follow-Up Message to the Thread
        await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            { role: "user", content: userMessage },
            { headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json", "OpenAI-Beta": "assistants=v2" } }
        );

        // ✅ Run Assistant on Existing Thread
        const runResponse = await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/runs`,
            { assistant_id: ASSISTANT_ID },
            { headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json", "OpenAI-Beta": "assistants=v2" } }
        );
        const runId = runResponse.data.id;

        // ✅ Poll for Completion
        let runStatus = "in_progress";
        while (runStatus === "in_progress") {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            const statusResponse = await axios.get(
                `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
                { headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json", "OpenAI-Beta": "assistants=v2" } }
            );
            runStatus = statusResponse.data.status;
        }

        // ✅ Retrieve AI Response
        const messagesResponse = await axios.get(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            { headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json", "OpenAI-Beta": "assistants=v2" } }
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

        res.json({ reply: aiTextResponses });

    } catch (error) {
        console.error("❌ Error in AI Chat:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "AI chat failed.", details: error.response ? error.response.data : error.message });
    }
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

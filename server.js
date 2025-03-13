const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

const userThreads = {}; // Stores thread IDs per user

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = "asst_fpGZKkTQYwZ94o0DxGAm89mo"; // Replace with your actual Assistant ID

// ✅ Analyze PPC Data (With Memory)
app.post("/analyze-ppc", async (req, res) => {
    try {
        const { userId, summary } = req.body;

        if (!userId || !summary) {
            return res.status(400).json({ error: "Missing userId or summary data." });
        }

        // Check if user already has a thread
        let threadId = userThreads[userId];

        // ✅ Step 1: Create a new thread if one doesn't exist
        if (!threadId) {
            const threadResponse = await axios.post(
                "https://api.openai.com/v1/threads",
                {},
                { headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json", "OpenAI-Beta": "assistants=v2" } }
            );
            threadId = threadResponse.data.id;
            userThreads[userId] = threadId; // Store the thread ID
        }

        // ✅ Step 2: Send PPC Data as Initial Message
        await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            { role: "user", content: `Analyze this PPC campaign data and provide insights: ${JSON.stringify(summary)}` },
            { headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json", "OpenAI-Beta": "assistants=v2" } }
        );

        // ✅ Step 3: Run the Assistant on the thread
        const runResponse = await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/runs`,
            { assistant_id: ASSISTANT_ID },
            { headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json", "OpenAI-Beta": "assistants=v2" } }
        );
        const runId = runResponse.data.id;

        // ✅ Step 4: Poll for Completion
        let runStatus = "in_progress";
        while (runStatus === "in_progress") {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            const statusResponse = await axios.get(
                `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
                { headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json", "OpenAI-Beta": "assistants=v2" } }
            );
            runStatus = statusResponse.data.status;
        }

        // ✅ Step 5: Retrieve Messages from the Thread
        const messagesResponse = await axios.get(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            { headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json", "OpenAI-Beta": "assistants=v2" } }
        );

        // Extract AI response properly
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

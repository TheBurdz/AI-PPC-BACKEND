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
        const threadId = threadResponse.data.id;

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
            {
                assistant_id: "g-67d0cbfcf9488191afeb8bf44673fb55"
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

        // Step 4: Poll for Completion
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
        }

        // Step 5: Retrieve Messages from the Thread
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
        const aiResponse = messagesResponse.data.data
            .filter(msg => msg.role === "assistant")
            .map(msg => msg.content)
            .join("\n");

        res.json({ insights: aiResponse });

    } catch (error) {
        console.error("Error in AI Processing:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "AI processing failed.", details: error.response ? error.response.data : error.message });
    }
});

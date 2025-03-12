require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors());

// Load API key from .env file
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 🔹 Test Route for Browsers (Check if Server is Live)
app.get('/', (req, res) => {
    res.send("AI PPC Backend is Live!");
});

// 🔹 API Route to Analyze PPC Data
app.post('/analyze-ppc', async (req, res) => {
    try {
        const ppcData = req.body;

        const openAIResponse = await axios.post(
            'https://api.openai.com/v1/assistants/asst_fpGZKkTQYwZ94o0DxGAm89mo/messages',
            {
                model: "gpt-4o",
                messages: [
                    { role: "system", content: "You are a specialized AI for Amazon PPC analysis." },
                    { role: "user", content: `Analyze this PPC campaign data and provide insights: ${JSON.stringify(ppcData)}` }
                ],
                temperature: 0.7
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        res.json({ insights: openAIResponse.data.choices[0].message.content });

    } catch (error) {
        console.error("Error in AI Processing:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "AI processing failed.", details: error.response ? error.response.data : error.message });
    }
});



// 🔹 Use Render’s Dynamic Port
const PORT = process.env.PORT || 10000; // Fallback to 10000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

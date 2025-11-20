const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Configure multer for audio uploads
const upload = multer({
  dest: 'uploads/temp/',
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit for Whisper API
});

// POST transcribe audio to text using OpenAI Whisper
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No audio file provided' });
    }

    console.log('Transcribing audio file:', req.file.path);

    // Create a read stream for the audio file
    const audioFile = fs.createReadStream(req.file.path);

    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en', // Can be made dynamic based on user preference
      response_format: 'json'
    });

    // Clean up temp file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      transcription: transcription.text
    });
  } catch (error) {
    console.error('Error transcribing audio:', error);

    // Clean up temp file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Transcription failed'
    });
  }
});

// POST analyze context from transcription using GPT-4
router.post('/analyze-context', async (req, res) => {
  try {
    const { transcription, contactName, venue } = req.body;

    if (!transcription) {
      return res.status(400).json({ success: false, error: 'Transcription text required' });
    }

    console.log('Analyzing context for:', contactName);

    const prompt = `You are an AI assistant helping to analyze networking context. A user just met someone and recorded voice notes about the interaction.

Contact Name: ${contactName || 'Unknown'}
Meeting Location: ${venue || 'Not specified'}
Voice Note Transcription: "${transcription}"

Please analyze this context and extract the following in JSON format:
{
  "summary": "A concise 2-3 sentence summary of the interaction",
  "topics_discussed": ["array", "of", "3-5", "key", "topics"],
  "pain_points": ["any", "problems", "or", "needs", "mentioned"],
  "opportunities": ["potential", "business", "opportunities", "identified"],
  "suggested_follow_up": "Specific follow-up action recommended",
  "follow_up_priority": "hot|warm|cold",
  "suggested_follow_up_date": "YYYY-MM-DD format, calculate based on priority",
  "company_name": "company name if mentioned, otherwise null",
  "role_or_title": "their role/title if mentioned, otherwise null",
  "mutual_connections": ["any", "mutual", "connections", "mentioned"]
}

Respond ONLY with valid JSON. For follow_up_priority:
- "hot" = needs follow-up within 24 hours
- "warm" = follow-up within a week
- "cold" = low priority, passive follow-up`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that extracts structured information from networking context. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const analysis = JSON.parse(completion.choices[0].message.content);

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('Error analyzing context:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Context analysis failed'
    });
  }
});

// POST generate follow-up message
router.post('/generate-message', async (req, res) => {
  try {
    const {
      contactName,
      summary,
      topics,
      venue,
      followUpType,
      company
    } = req.body;

    if (!contactName || !summary) {
      return res.status(400).json({
        success: false,
        error: 'Contact name and summary required'
      });
    }

    console.log('Generating follow-up message for:', contactName);

    const prompt = `You are helping draft a personalized follow-up message after a networking interaction.

Context:
- Contact Name: ${contactName}
- Company: ${company || 'Unknown'}
- Where We Met: ${venue || 'recent event'}
- Conversation Summary: ${summary}
- Topics Discussed: ${topics ? topics.join(', ') : 'general networking'}
- Follow-up Intent: ${followUpType || 'general follow-up'}

Please generate 3 variations of a follow-up message (email format):
1. Professional/Formal tone
2. Friendly/Casual tone
3. Brief/Direct tone

Each message should:
- Reference where you met
- Mention a specific topic from your conversation
- Include clear call-to-action based on follow-up intent
- Be authentic and personalized (not generic)
- Be appropriate length for the tone

Respond in JSON format:
{
  "formal": {
    "subject": "email subject line",
    "body": "email body text"
  },
  "casual": {
    "subject": "email subject line",
    "body": "email body text"
  },
  "brief": {
    "subject": "email subject line",
    "body": "email body text"
  }
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'You are a professional networking assistant who helps write personalized follow-up messages. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const messages = JSON.parse(completion.choices[0].message.content);

    res.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Error generating message:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Message generation failed'
    });
  }
});

module.exports = router;

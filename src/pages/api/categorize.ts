// Next.js API route for AI categorization
import type { NextApiRequest, NextApiResponse } from 'next';

interface APIResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Google Gemini API call (server-side only)
async function callGeminiAPI(prompt: string, apiKey: string): Promise<any> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2000,
        topP: 0.8,
        topK: 10
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API Error:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText
    });
    
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Authentication failed with Google Gemini. Please check your API key.`);
    } else if (response.status === 429) {
      throw new Error(`Rate limit exceeded for Google Gemini. Please try again later.`);
    } else {
      throw new Error(`Google Gemini API error: ${response.status} ${response.statusText}`);
    }
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// OpenAI-compatible API call
async function callOpenAIAPI(provider: string, prompt: string, apiKey: string, model: string): Promise<any> {
  const endpoints: Record<string, string> = {
    openai: 'https://api.openai.com/v1/chat/completions',
    groq: 'https://api.groq.com/openai/v1/chat/completions'
  };

  const response = await fetch(endpoints[provider], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`${provider} API Error:`, {
      status: response.status,
      statusText: response.statusText,
      body: errorText
    });
    
    if (response.status === 401) {
      throw new Error(`Authentication failed with ${provider}. Please check your API key.`);
    } else if (response.status === 429) {
      throw new Error(`Rate limit exceeded for ${provider}. Please try again later.`);
    } else {
      throw new Error(`${provider} API error: ${response.status} ${response.statusText}`);
    }
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Anthropic API call
async function callAnthropicAPI(prompt: string, apiKey: string): Promise<any> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Anthropic API Error:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText
    });
    
    if (response.status === 401) {
      throw new Error(`Authentication failed with Anthropic. Please check your API key.`);
    } else if (response.status === 429) {
      throw new Error(`Rate limit exceeded for Anthropic. Please try again later.`);
    } else {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }
  }

  const data = await response.json();
  return data.content[0].text;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<APIResponse>) {
  console.log('API Route called:', req.method);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { messages, provider } = req.body;
    console.log('Received request:', { 
      messagesCount: messages?.length, 
      provider, 
      messages: messages?.slice(0, 2) // Log first 2 messages for debugging
    });

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.log('Invalid messages array');
      return res.status(400).json({ success: false, error: 'Messages array is required' });
    }

    if (!provider) {
      console.log('No provider specified');
      return res.status(400).json({ success: false, error: 'Provider is required' });
    }

    // Create categorization prompt
    const categoryList = [
      '- Payments & Purchases: Shopping, bills, invoices, retail purchases',
      '- Gifts & Tips: Gifts, donations, tips, rewards, presents',
      '- Business & Work: Salary, work-related, business, contracts, services',
      '- Family & Friends: Personal relationships, family, friends, loans',
      '- Food & Dining: Restaurants, food delivery, meals, dining',
      '- Transportation: Travel, transport, gas, parking, rideshare',
      '- Entertainment: Movies, games, sports, hobbies, subscriptions',
      '- Testing & Development: Testing, development, demo transactions',
      '- Other: Uncategorized or unclear transactions'
    ].join('\n');

    const prompt = `You are a financial transaction categorization expert. Analyze the following transaction messages and categorize each one.

Available Categories:
${categoryList}

Transaction Messages:
${messages.map((msg: string, idx: number) => `${idx + 1}. "${msg}"`).join('\n')}

For each transaction, respond with a JSON array where each object has:
{
  "transactionIndex": number (1-based),
  "category": string (exact category name from the list),
  "confidence": number (0-1),
  "reasoning": string (brief explanation)
}

Example response:
[
  {
    "transactionIndex": 1,
    "category": "Food & Dining",
    "confidence": 0.95,
    "reasoning": "Clear indication of food purchase"
  }
]

Respond only with the JSON array, no other text.`;

    let responseText: string;

    console.log(`Processing with provider: ${provider}`);

    // Call appropriate AI API based on provider
    if (provider === 'gemini') {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      console.log('Gemini API key available:', !!apiKey);
      if (!apiKey) {
        return res.status(400).json({ success: false, error: 'Gemini API key not configured' });
      }
      console.log('Calling Gemini API...');
      responseText = await callGeminiAPI(prompt, apiKey);
    } else if (provider === 'anthropic') {
      const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
      console.log('Anthropic API key available:', !!apiKey);
      if (!apiKey) {
        return res.status(400).json({ success: false, error: 'Anthropic API key not configured' });
      }
      responseText = await callAnthropicAPI(prompt, apiKey);
    } else if (provider === 'openai') {
      const apiKey = process.env.NEXT_PUBLIC_AI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
      console.log('OpenAI API key available:', !!apiKey);
      if (!apiKey) {
        return res.status(400).json({ success: false, error: 'OpenAI API key not configured' });
      }
      responseText = await callOpenAIAPI('openai', prompt, apiKey, 'gpt-3.5-turbo');
    } else if (provider === 'groq') {
      const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || process.env.NEXT_PUBLIC_AI_API_KEY;
      console.log('Groq API key available:', !!apiKey);
      if (!apiKey) {
        return res.status(400).json({ success: false, error: 'Groq API key not configured' });
      }
      responseText = await callOpenAIAPI('groq', prompt, apiKey, 'llama3-8b-8192');
    } else {
      console.log('Unknown provider:', provider);
      return res.status(400).json({ success: false, error: 'Unknown provider' });
    }

    console.log('AI Response received:', responseText.slice(0, 100) + '...');

    // Parse AI response
    let aiResults;
    try {
      // Clean up the response in case there's extra text
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      const jsonText = jsonMatch ? jsonMatch[0] : responseText.trim();
      console.log('Parsing JSON:', jsonText.slice(0, 200) + '...');
      aiResults = JSON.parse(jsonText);
      console.log('Parsed results:', aiResults);
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText);
      return res.status(500).json({ 
        success: false, 
        error: `Failed to parse AI response as JSON: ${parseError}` 
      });
    }

    console.log('Returning successful response with', aiResults.length, 'results');
    return res.status(200).json({ success: true, data: aiResults });

  } catch (error) {
    console.error('AI categorization error:', error);
    
    let errorMessage = 'AI categorization failed';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    console.log('Returning error response:', errorMessage);
    return res.status(500).json({ success: false, error: errorMessage });
  }
}
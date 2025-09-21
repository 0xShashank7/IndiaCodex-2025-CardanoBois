interface AICategory {
  category: string;
  confidence: number;
  reasoning: string;
  icon: string;
  color: string;
}

interface CategorizedTransaction {
  transactionId: string;
  category: AICategory;
}

// Define available categories that the AI can choose from
export const AVAILABLE_CATEGORIES = [
  {
    name: 'Payments & Purchases',
    description: 'Shopping, bills, invoices, retail purchases',
    icon: '💳',
    color: 'bg-blue-100 border-blue-300 text-blue-800'
  },
  {
    name: 'Gifts & Tips',
    description: 'Gifts, donations, tips, rewards, presents',
    icon: '🎁',
    color: 'bg-pink-100 border-pink-300 text-pink-800'
  },
  {
    name: 'Business & Work',
    description: 'Salary, work-related, business, contracts, services',
    icon: '💼',
    color: 'bg-indigo-100 border-indigo-300 text-indigo-800'
  },
  {
    name: 'Family & Friends',
    description: 'Personal relationships, family, friends, loans',
    icon: '👨‍👩‍👧‍👦',
    color: 'bg-yellow-100 border-yellow-300 text-yellow-800'
  },
  {
    name: 'Food & Dining',
    description: 'Restaurants, food delivery, meals, dining',
    icon: '🍽️',
    color: 'bg-orange-100 border-orange-300 text-orange-800'
  },
  {
    name: 'Transportation',
    description: 'Travel, transport, gas, parking, rideshare',
    icon: '🚗',
    color: 'bg-green-100 border-green-300 text-green-800'
  },
  {
    name: 'Entertainment',
    description: 'Movies, games, sports, hobbies, subscriptions',
    icon: '🎮',
    color: 'bg-purple-100 border-purple-300 text-purple-800'
  },
  {
    name: 'Testing & Development',
    description: 'Testing, development, demo transactions',
    icon: '🧪',
    color: 'bg-gray-100 border-gray-300 text-gray-800'
  },
  {
    name: 'Other',
    description: 'Uncategorized or unclear transactions',
    icon: '💬',
    color: 'bg-gray-100 border-gray-300 text-gray-800'
  }
];

// AI Provider configurations
interface AIProvider {
  name: string;
  apiKey?: string;
  endpoint: string;
  model: string;
}

const AI_PROVIDERS: Record<string, AIProvider> = {
  openai: {
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-3.5-turbo'
  },
  gemini: {
    name: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
    model: 'gemini-1.5-flash-latest'
  },
  anthropic: {
    name: 'Anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-haiku-20240307'
  },
  groq: {
    name: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama3-8b-8192'
  }
};

// Create the prompt for AI categorization
function createCategorizationPrompt(messages: string[]): string {
  const categoryList = AVAILABLE_CATEGORIES.map(cat => 
    `- ${cat.name}: ${cat.description}`
  ).join('\n');

  return `You are a financial transaction categorization expert. Analyze the following transaction messages and categorize each one.

Available Categories:
${categoryList}

Transaction Messages:
${messages.map((msg, idx) => `${idx + 1}. "${msg}"`).join('\n')}

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
}

// Call OpenAI-compatible API
async function callOpenAIAPI(provider: AIProvider, prompt: string): Promise<any> {
  // Get API key with multiple fallbacks
  const apiKey = provider.apiKey || 
                 process.env.NEXT_PUBLIC_AI_API_KEY || 
                 process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
                 (provider.name === 'Groq' ? process.env.NEXT_PUBLIC_GROQ_API_KEY : null);

  if (!apiKey) {
    throw new Error(`No API key found for ${provider.name}. Please add NEXT_PUBLIC_AI_API_KEY to your .env.local file.`);
  }

  console.log(`Using ${provider.name} API with key: ${apiKey.slice(0, 8)}...`);

  const response = await fetch(provider.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: provider.model,
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
    console.error(`${provider.name} API Error:`, {
      status: response.status,
      statusText: response.statusText,
      body: errorText
    });
    
    if (response.status === 401) {
      throw new Error(`Authentication failed with ${provider.name}. Please check your API key in .env.local file.`);
    } else if (response.status === 429) {
      throw new Error(`Rate limit exceeded for ${provider.name}. Please try again later.`);
    } else if (response.status === 400) {
      throw new Error(`Bad request to ${provider.name}. Please check your input.`);
    } else {
      throw new Error(`${provider.name} API error: ${response.status} ${response.statusText}`);
    }
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Call Anthropic API
async function callAnthropicAPI(provider: AIProvider, prompt: string): Promise<any> {
  const apiKey = provider.apiKey || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(`No API key found for Anthropic. Please add NEXT_PUBLIC_ANTHROPIC_API_KEY to your .env.local file.`);
  }

  console.log(`Using Anthropic API with key: ${apiKey.slice(0, 8)}...`);

  const response = await fetch(provider.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: provider.model,
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
      throw new Error(`Authentication failed with Anthropic. Please check your API key in .env.local file.`);
    } else if (response.status === 429) {
      throw new Error(`Rate limit exceeded for Anthropic. Please try again later.`);
    } else {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }
  }

  const data = await response.json();
  return data.content[0].text;
}

// Call Google Gemini API
async function callGeminiAPI(provider: AIProvider, prompt: string): Promise<any> {
  const apiKey = provider.apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(`No API key found for Google Gemini. Please add NEXT_PUBLIC_GEMINI_API_KEY to your .env.local file.`);
  }

  console.log(`Using Google Gemini API with key: ${apiKey.slice(0, 8)}...`);

  const response = await fetch(`${provider.endpoint}?key=${apiKey}`, {
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
      throw new Error(`Authentication failed with Google Gemini. Please check your API key in .env.local file.`);
    } else if (response.status === 429) {
      throw new Error(`Rate limit exceeded for Google Gemini. Please try again later.`);
    } else {
      throw new Error(`Google Gemini API error: ${response.status} ${response.statusText}`);
    }
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// Main categorization function - now uses Next.js API route
export async function categorizeTransactionsWithAI(
  messages: string[],
  provider: string = 'gemini'
): Promise<CategorizedTransaction[]> {
  if (messages.length === 0) {
    return [];
  }

  try {
    console.log(`Starting AI categorization with ${provider} for ${messages.length} messages`);
    console.log('Messages to categorize:', messages);
    
    // Call our Next.js API route instead of calling AI APIs directly
    const response = await fetch('/api/categorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: messages,
        provider: provider
      })
    });

    console.log('API Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`API error: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const responseData = await response.json();
    console.log('API Response data:', responseData);
    
    const { success, data, error } = responseData;
    
    if (!success) {
      throw new Error(error || 'API request failed');
    }

    const aiResults = data;
    console.log('AI Results from API:', aiResults);
    
    // Convert AI results to our format
    const categorizedTransactions: CategorizedTransaction[] = aiResults.map((result: any) => {
      const categoryConfig = AVAILABLE_CATEGORIES.find(cat => cat.name === result.category) 
        || AVAILABLE_CATEGORIES.find(cat => cat.name === 'Other')!;

      return {
        transactionId: `tx_${result.transactionIndex}`,
        category: {
          category: result.category,
          confidence: result.confidence,
          reasoning: result.reasoning,
          icon: categoryConfig.icon,
          color: categoryConfig.color
        }
      };
    });

    console.log(`Successfully categorized ${categorizedTransactions.length} transactions`);
    return categorizedTransactions;

  } catch (error) {
    console.error('AI categorization error:', error);
    
    // Provide more specific error message
    let errorMessage = 'AI categorization failed';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    // Fallback to "Other" category for all transactions
    return messages.map((_, index) => ({
      transactionId: `tx_${index + 1}`,
      category: {
        category: 'Other',
        confidence: 0,
        reasoning: `AI categorization failed: ${errorMessage}`,
        icon: '💬',
        color: 'bg-gray-100 border-gray-300 text-gray-800'
      }
    }));
  }
}

// Utility function to get available AI providers
export function getAvailableProviders(): string[] {
  const providers = [];
  
  // Check for OpenAI API keys
  if (process.env.NEXT_PUBLIC_AI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
    providers.push('openai');
  }
  
  // Check for Google Gemini API key
  if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
    providers.push('gemini');
  }
  
  // Check for Anthropic API key
  if (process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY) {
    providers.push('anthropic');
  }
  
  // Check for Groq API key
  if (process.env.NEXT_PUBLIC_GROQ_API_KEY || process.env.NEXT_PUBLIC_AI_API_KEY) {
    providers.push('groq');
  }

  console.log('Available AI providers:', providers);
  console.log('Environment variables check:', {
    hasOpenAI: !!(process.env.NEXT_PUBLIC_AI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY),
    hasGemini: !!process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    hasAnthropic: !!process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
    hasGroq: !!process.env.NEXT_PUBLIC_GROQ_API_KEY,
    generalKey: !!process.env.NEXT_PUBLIC_AI_API_KEY
  });

  // Always include at least one provider for demo (but warn user)
  if (providers.length === 0) {
    console.warn('No AI API keys found. AI categorization will not work without proper API keys.');
    providers.push('openai'); // Default fallback
  }
  
  return providers;
}

// Check if AI categorization is available
export function isAICategorationAvailable(): boolean {
  return getAvailableProviders().length > 0;
}
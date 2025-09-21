# AI Transaction Categorization Setup Guide

## Quick Setup

The 401 error means your AI API key is not configured. Here's how to fix it:

### 1. Create Environment File
Copy the example environment file:
```bash
cp .env.example .env.local
```

### 2. Add Your API Key
Edit `.env.local` and add your API key:

#### Option A: Google Gemini (Recommended - Generous Free Tier!)
```env
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
```

#### Option B: OpenAI
```env
NEXT_PUBLIC_AI_API_KEY=sk-your-openai-api-key-here
```

#### Option C: Groq (Free tier available)
```env
NEXT_PUBLIC_GROQ_API_KEY=gsk_your-groq-api-key-here
```

#### Option D: Anthropic Claude
```env
NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
```

### 3. Get API Keys

#### Google Gemini (Best Choice - Free & Powerful!)
1. Go to https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key (starts with `AIza`)
5. **Free Tier**: 15 requests/minute, 1500 requests/day!

#### OpenAI (Most reliable)
1. Go to https://platform.openai.com/api-keys
2. Sign up/login
3. Create new API key
4. Copy the key (starts with `sk-`)

#### Groq (Fastest, free tier)
1. Go to https://console.groq.com/keys
2. Sign up/login
3. Create new API key
4. Copy the key (starts with `gsk_`)

#### Anthropic (Claude AI)
1. Go to https://console.anthropic.com/
2. Sign up/login
3. Create new API key
4. Copy the key (starts with `sk-ant-`)

### 4. Restart Development Server
After adding the API key:
```bash
npm run dev
```

### 5. Test AI Categorization
1. Connect your wallet
2. Make sure you have transactions with messages
3. Click "🤖 Categorize with AI"
4. Select your provider from the dropdown (choose "Gemini" if you got a Gemini key)

## Troubleshooting

### Still getting 401 errors?
- Make sure your `.env.local` file is in the project root
- Check that your API key is valid and hasn't expired
- Verify you have sufficient credits/quota on your AI provider account
- Check the browser console for detailed error messages

### No transactions to categorize?
- The AI only works on transactions that have message content
- Make sure your wallet has transactions with attached messages
- Try with mock data first to test the AI functionality

### Rate limits?
- OpenAI: 3 requests/minute on free tier
- Groq: 30 requests/minute on free tier  
- Anthropic: Varies by plan

## Cost Estimates
- **Google Gemini**: FREE! (15 requests/minute, 1500/day)
- OpenAI GPT-3.5-Turbo: ~$0.001 per 50 transactions
- Groq Llama: Free tier available
- Anthropic Claude: ~$0.002 per 50 transactions

**Recommendation**: Start with Google Gemini - it's completely free and very powerful for this use case!
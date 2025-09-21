<<<<<<< HEAD
# AI-Powered Cardano Transaction Dashboard

An intelligent blockchain transaction analyzer that uses AI to automatically categorize and visualize Cardano transactions with interactive and real-time insights.

## Project Team
Built By Shashank G & Jashwanth S

## 🎯 Project Overview

Transform complex Cardano blockchain data into intuitive, AI-powered insights. This dashboard connects to your Cardano wallet, fetches transaction history from the Preprod network, and uses advanced AI models to automatically categorize your spending patterns

## ✨ Key Features

### 🤖 **AI-Powered Transaction Categorization**
- **Multi-AI Provider Support**: Google Gemini, OpenAI, Groq, and Anthropic Claude
- **Smart Analysis**: Understands context, slang, and transaction purposes
- **Confidence Scoring**: Each categorization includes AI certainty percentage
- **Automatic Processing**: Categories are generated automatically when transactions load

### 📊 **Interactive Data Visualization**
- **Smooth Bar Graphs**: Gradient-filled charts with hover effects and animations
- **Modal Deep-Dive**: Click any category bar to see detailed transaction breakdowns
- **Real-time Updates**: Live blockchain data with automatic refresh
- **Transaction Insights**: View AI reasoning for each categorization decision

### 🎨 **Modern UI/UX Design**
- **Dark Mode**: Consistent dark theme with contrasting colors
- **Glass-Morphism Effects**: Modern card designs with shadows and gradients
- **Responsive Layout**: Mobile-first design that works on all screen sizes
- **Geometric Patterns**: Beautiful background with subtle animations

### 🔗 **Blockchain Integration**
- **Cardano Preprod Network**: Live testnet data via Blockfrost API
- **UTXO Analysis**: Accurate transaction amount calculation for Cardano's model
- **Wallet Integration**: Seamless connection using MeshSDK
- **Network Status**: Real-time blockchain connectivity indicators

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- Cardano wallet (Nami, Eternl, etc.)
- Blockfrost API key (free)
- AI API key (Google Gemini recommended - free tier)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd <project>

# Install dependencies
npm install

### Environment Configuration

Edit `.env.local` with your API keys:

```env
# Blockfrost API Key (Get from: https://blockfrost.io)
NEXT_PUBLIC_BLOCKFROST_API_KEY=preprodXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# AI API Keys (Choose one or more)
NEXT_PUBLIC_GEMINI_API_KEY=AIzaXXXXXXXXXXXXXXXXXXXXXXXXXXXX  # Recommended - Free tier
NEXT_PUBLIC_AI_API_KEY=sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX  # OpenAI
NEXT_PUBLIC_GROQ_API_KEY=gsk_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX  # Groq
NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-ant-XXXXXXXXXXXXXXXXXXXXX  # Anthropic
```

### Run Development Server

```bash
npm run dev
```


## 🎮 How to Use

1. **Connect Wallet**: Click "Connect Wallet" and select your Cardano wallet
2. **Auto-Analysis**: Transactions are automatically fetched and AI categorizes them
3. **Explore Categories**: View the interactive bar graph showing spending patterns
4. **Deep Dive**: Click any category bar to see detailed transaction breakdowns
5. **AI Insights**: Review confidence scores and AI reasoning for each category

## 📊 AI Categories

The AI automatically categorizes transactions into:

- **🍕 Food & Dining**: Restaurants, groceries, coffee shops
- **💼 Business & Work**: Freelance payments, business expenses, salary
- **🎁 Gifts & Tips**: Personal gifts, tips, donations
- **🏠 Bills & Utilities**: Rent, utilities, subscriptions
- **🛒 Shopping**: Online purchases, retail spending
- **💰 Investment**: DeFi, trading, staking rewards
- **👨‍👩‍👧‍👦 Family & Friends**: Personal transfers, family support
- **🚗 Transportation**: Travel, ride-sharing, fuel
- **📱 Other**: Miscellaneous transactions

## 🛠️ Tech Stack

- **Frontend**: Next.js 13+, TypeScript, Tailwind CSS
- **Blockchain**: Cardano, Blockfrost API, MeshSDK
- **AI Integration**: Google Gemini
- **State Management**: React Hooks
- **Styling**: Custom CSS with tailwind
- **API Routes**: Next.js serverless functions for AI calls

## 🏗️ Project Structure

```
src/
├── pages/
│   ├── index.tsx              # Landing page with wallet connection
│   ├── dashboard.tsx          # Main dashboard with AI categorization
│   └── api/
│       └── categorize.ts      # Server-side AI API integration
├── utils/
│   ├── blockchain.ts          # Cardano blockchain utilities
│   └── aiCategorization.ts    # AI categorization logic
└── styles/
    └── globals.css            # Dark mode design system
```

## 🎨 Design Features

- **Consistent Color Scheme**: Professional dark theme with blue gradients
- **Interactive Elements**: Smooth hover effects and transitions
- **Typography Hierarchy**: Clear visual hierarchy with gradient text

## 🤝 Contributing

We welcome contributions! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- **Live Demo**: [deployment URL](https://india-codex-2025-cardano-bois.vercel.app/)
- **Documentation**: [Mesh.js Docs](https://meshjs.dev)
- **Cardano**: [cardano.org](https://cardano.org)
- **Blockfrost**: [blockfrost.io](https://blockfrost.io)

## 📧 Support

For questions and support:
- Create an issue in this repository
- Join [Mesh Discord](https://meshjs.dev/go/discord)
- Follow [Mesh Twitter](https://meshjs.dev/go/twitter)

---

**Built with ❤️ using Mesh.js, Cardano, and AI**
=======
# IndiaCodex 2025


Welcome to [**IndiaCodex'25 Hackathon**](https://www.indiacodex.com) powered by [**Nucast Labs**](https://nucast.io/)
Please find attached the rules and steps to submit your project for the hackathon :

## Step - 1: Fork the repository

Fork the given repository to your GitHub profile.


## Step - 2: Create your folder

After forking the repository, clone the repository to your pc/desktop, and then create a folder with your **TeamName** as the folder name.

Unclear about cloning? No problem, we've got your back. Click [here](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) to learn about it.

## Step - 3: Project Code Base

Push Your code base in this folder.
This should include all your files for frontend as well as the backend

## Step - 4: Team Info and Project Info

In your **TeamName** folder, make sure to include the below details in the README.md:

1. Your Project
2. Your Project's Description
3. What problem you are trying to solve
4. Tech Stack used while building the project
5. Project Demo Photos, Videos
6. If your project is deployed, then include the Live Project Link
7. Your PPT link (Make sure to upload the PPT in this folder along with the project)
8. Your Team Members' Info.

## Step - 5: Submitting the code: Making a Pull request

After you have pushed your files and code base,
[create an issue](https://github.com/IndiaCodex/IndiaCodex-2025/issues) in the main repository as:

- Issue: Team Name: Submission
- Issue description should include a small glimpse of your project, what is it doing, and how are you trying to achieve it.

After the issue is assigned, make a [Pull Request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request) from your forked repo to this repo's main branch while mentioning issue no. assigned to it.

## Guides and Rules for submission:

1. Make sure you fork the repository first, and create a folder with your team name.
2. Make all your code added to your forked repo, and then push the code to your main branch after your project is complete.
3. Make sure to push files to your folder only.
4. Changing or doing any edits to other folders is strictly prohibited.
>>>>>>> ae57fdb95a1330e3a7567ae973b3f3cabf82b0c6

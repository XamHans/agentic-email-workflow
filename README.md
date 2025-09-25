# Email-Calendar Agentic Workflow

An intelligent email processing system that automatically handles emails by classifying intents and taking appropriate actions like archiving, replying, or scheduling meetings. This project demonstrates three different architectural approaches to building agentic workflows.

## 🏗️ Architecture Variants

### 1. Native Implementation (`email-workflow-native/`)
**Pure Vercel AI SDK approach**
- Direct integration with Gmail and Calendar APIs
- Simple imperative control flow
- Minimal dependencies: Vercel AI SDK, googleapis, express
- Best for: Learning AI SDK fundamentals and simple linear workflows

### 2. Mastra Sequential (`agentic-email-workflow/`)
**Agent-based architecture with sequential processing**
- Uses Mastra framework for agent orchestration
- Step-by-step workflow execution with specialized agents
- Built-in memory, logging, and state management
- Best for: Structured workflows with clear sequential dependencies

### 3. Mastra Parallel (`email-ai-workflow-parallel/`)
**Advanced workflow orchestration with parallel processing**
- Concurrent email processing capabilities
- Complex workflow management with parallel execution
- Enhanced agent coordination and resource optimization
- Best for: High-throughput email processing and complex business logic

## 🔄 Workflow Overview

All variants implement the same core workflow:

1. **Fetch** unread emails from Gmail
2. **Classify** email intent using AI (reply, meeting, archive, human_review)
3. **Process** based on classification:
   - **Reply**: Generate and send automated response
   - **Meeting**: Create calendar events and suggest meeting times
   - **Archive**: Move email to archive
   - **Human Review**: Flag for manual review
4. **Track** actions and maintain audit logs

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 20.9.0
- Gmail API credentials
- Google Calendar API credentials
- OpenAI API key

### Choose Your Implementation

```bash
# Clone the repository
git clone [repository-url]
cd agentic-email-handler-workflow

# Option 1: Native Implementation
cd email-workflow-native
npm install
# Configure .env and credentials
npm start

# Option 2: Mastra Sequential
cd agentic-email-workflow
npm install
# Configure .env and credentials
npm run dev

# Option 3: Mastra Parallel
cd email-ai-workflow-parallel
npm install
# Configure .env and credentials
npm run dev
```

## 📊 Technical Comparison

| Feature | Native | Mastra Sequential | Mastra Parallel |
|---------|---------|------------------|-----------------|
| **Framework** | Vercel AI SDK | Mastra | Mastra |
| **Processing** | Linear | Sequential | Parallel |
| **Complexity** | Low | Medium | High |
| **Scalability** | Basic | Good | Excellent |
| **Memory Management** | Manual | Built-in | Built-in |
| **Workflow Orchestration** | None | Basic | Advanced |
| **Learning Curve** | Gentle | Moderate | Steep |

## 📁 Project Structure

```
agentic-email-handler-workflow/
├── email-workflow-native/          # Pure AI SDK implementation
│   ├── src/
│   │   ├── main.ts                 # Main workflow logic
│   │   ├── ai.ts                   # AI intent classification
│   │   ├── actions.ts              # Email action handlers
│   │   └── auth.ts                 # Google API authentication
│   └── package.json
│
├── agentic-email-workflow/         # Mastra sequential workflow
│   ├── src/mastra/
│   │   ├── agents/                 # Specialized AI agents
│   │   ├── tools/                  # Gmail/Calendar tools
│   │   └── workflows/              # Sequential workflow definition
│   └── package.json
│
└── email-ai-workflow-parallel/     # Mastra parallel workflow
    ├── src/mastra/
    │   ├── agents/                 # Intent and action agents
    │   ├── tools/                  # Enhanced tool implementations
    │   └── workflows/              # Parallel workflow orchestration
    └── package.json
```

## 🎓 Learning & Community

- **Tutorial**: YouTube tutorial coming soon!
- **Get Help**: Join our [AI Builders Community](https://www.skool.com/ai-builders-6997/about?ref=873c5678d6d845feba1c23c6dbccdce3) on Skool
- **Discuss**: Share your implementations and get support from fellow builders

## 🔧 Configuration

Each variant requires:
- Gmail API credentials (`credentials.json`)
- Google Calendar API access
- OpenAI API key in `.env` file
- OAuth token generation for Gmail/Calendar access

Refer to individual variant README files for detailed setup instructions.

## 🤝 Contributing

We welcome contributions! Whether you want to:
- Improve existing implementations
- Add new variants or features
- Enhance documentation
- Share your workflow adaptations

Feel free to open issues and submit pull requests.

## 📄 License

MIT License - feel free to use this project as a foundation for your own agentic workflows.

---

*Start with the native implementation to understand the core concepts, then explore Mastra variants for more advanced workflow orchestration capabilities.*
import OpenAI from 'openai';
import { openRouterConfig } from '../config/openrouter';
import { AgentMemory, MemoryEntry, ReflexionEntry } from '../memory/agent-memory';
import { v4 as uuidv4 } from 'uuid';

export interface ResearchTask {
  id: string;
  topic: string;
  query: string;
  depth: number;
  context?: string[];
}

export interface ResearchResult {
  taskId: string;
  topic: string;
  query: string;
  response: string;
  sources: string[];
  insights: string[];
  confidence: number;
  subTasks: ResearchTask[];
  timestamp: Date;
}

export class ResearchAgent {
  private client: OpenAI;
  private memory: AgentMemory;
  private agentId: string;
  private agentType: string;

  constructor(agentType: string = 'researcher', memory?: AgentMemory) {
    this.agentId = uuidv4();
    this.agentType = agentType;
    this.memory = memory || new AgentMemory();

    this.client = new OpenAI({
      baseURL: openRouterConfig.baseURL,
      apiKey: openRouterConfig.apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/ruvnet/vibecast',
        'X-Title': 'Vibecast Research System',
      },
    });
  }

  public async research(task: ResearchTask): Promise<ResearchResult> {
    console.log(`🔍 [${this.agentType}:${this.agentId.slice(0, 8)}] Researching: ${task.topic}`);

    // Check if we have relevant memories
    const relevantMemories = this.memory.searchMemories(task.query, 3);
    const memoryContext = relevantMemories.length > 0
      ? `\n\nRelevant past research:\n${relevantMemories.map(m =>
          `- ${m.topic}: ${m.insights.join(', ')}`
        ).join('\n')}`
      : '';

    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.buildResearchPrompt(task, memoryContext);

    try {
      const response = await this.client.chat.completions.create({
        model: openRouterConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: openRouterConfig.temperature,
        max_tokens: 4096,
      });

      const content = response.choices[0].message.content || '';
      const result = this.parseResearchResponse(content, task);

      // Store in memory
      const memoryEntry: MemoryEntry = {
        id: result.taskId,
        timestamp: result.timestamp,
        topic: result.topic,
        query: result.query,
        response: result.response,
        sources: result.sources,
        insights: result.insights,
        confidence: result.confidence,
        tags: this.extractTags(content),
      };
      this.memory.addMemory(memoryEntry);

      // Perform reflexion if confidence is low
      if (result.confidence < 0.7) {
        await this.performReflexion(result, memoryEntry);
      }

      return result;
    } catch (error) {
      console.error(`❌ Research error:`, error);
      throw error;
    }
  }

  private getSystemPrompt(): string {
    return `You are an advanced research agent powered by Kimi K2, a trillion-parameter AI model optimized for reasoning, tool use, and code synthesis.

Your capabilities include:
- Deep research and analysis
- Causal reasoning and critical thinking
- Synthesis of complex information
- Identification of knowledge gaps
- Generation of follow-up research questions

When conducting research:
1. Provide comprehensive, well-reasoned responses
2. Identify key insights and patterns
3. Suggest related areas for deeper investigation
4. Cite sources when applicable
5. Assess your confidence level (0-1) in the findings
6. Generate follow-up questions for deeper research

Format your response as:
RESPONSE: [Your main research findings]
INSIGHTS: [Key insights, one per line]
SOURCES: [Relevant sources or areas of knowledge]
CONFIDENCE: [0-1]
FOLLOW_UP: [Suggested follow-up research questions]`;
  }

  private buildResearchPrompt(task: ResearchTask, memoryContext: string): string {
    const contextStr = task.context && task.context.length > 0
      ? `\n\nContext from previous research:\n${task.context.join('\n')}`
      : '';

    return `Research Topic: ${task.topic}

Query: ${task.query}

Research Depth: ${task.depth}/3${contextStr}${memoryContext}

Please conduct thorough research on this topic and provide detailed findings.`;
  }

  private parseResearchResponse(content: string, task: ResearchTask): ResearchResult {
    const responseMatch = content.match(/RESPONSE:\s*([\s\S]*?)(?=INSIGHTS:|$)/i);
    const insightsMatch = content.match(/INSIGHTS:\s*([\s\S]*?)(?=SOURCES:|$)/i);
    const sourcesMatch = content.match(/SOURCES:\s*([\s\S]*?)(?=CONFIDENCE:|$)/i);
    const confidenceMatch = content.match(/CONFIDENCE:\s*([\d.]+)/i);
    const followUpMatch = content.match(/FOLLOW_UP:\s*([\s\S]*?)$/i);

    const response = responseMatch ? responseMatch[1].trim() : content;
    const insights = insightsMatch
      ? insightsMatch[1].trim().split('\n').filter(s => s.trim())
      : [];
    const sources = sourcesMatch
      ? sourcesMatch[1].trim().split('\n').filter(s => s.trim())
      : [];
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5;
    const followUpQuestions = followUpMatch
      ? followUpMatch[1].trim().split('\n').filter(s => s.trim())
      : [];

    // Generate sub-tasks from follow-up questions
    const subTasks: ResearchTask[] = task.depth < 3
      ? followUpQuestions.slice(0, 2).map(q => ({
          id: uuidv4(),
          topic: task.topic,
          query: q.replace(/^[-•*]\s*/, '').trim(),
          depth: task.depth + 1,
          context: [response],
        }))
      : [];

    return {
      taskId: task.id,
      topic: task.topic,
      query: task.query,
      response,
      sources,
      insights,
      confidence,
      subTasks,
      timestamp: new Date(),
    };
  }

  private extractTags(content: string): string[] {
    // Simple tag extraction based on common keywords
    const tags: string[] = [];
    const keywords = ['AI', 'machine learning', 'research', 'analysis', 'data', 'algorithm', 'model'];

    keywords.forEach(keyword => {
      if (content.toLowerCase().includes(keyword.toLowerCase())) {
        tags.push(keyword);
      }
    });

    return tags;
  }

  private async performReflexion(result: ResearchResult, memoryEntry: MemoryEntry): Promise<void> {
    console.log(`🤔 [${this.agentType}] Performing reflexion on low-confidence result...`);

    const reflexionPrompt = `Review and critique the following research response:

Topic: ${result.topic}
Query: ${result.query}
Response: ${result.response}
Confidence: ${result.confidence}

Provide:
1. Critical analysis of the response
2. Identified weaknesses or gaps
3. Suggestions for improvement
4. Key learning points

Format as:
CRITIQUE: [Your critique]
IMPROVEMENTS: [Suggested improvements]
LEARNING: [Key learning points]`;

    try {
      const response = await this.client.chat.completions.create({
        model: openRouterConfig.model,
        messages: [
          { role: 'system', content: 'You are a critical thinking agent performing self-reflection.' },
          { role: 'user', content: reflexionPrompt },
        ],
        temperature: 0.5,
        max_tokens: 2048,
      });

      const content = response.choices[0].message.content || '';
      const critiqueMatch = content.match(/CRITIQUE:\s*([\s\S]*?)(?=IMPROVEMENTS:|$)/i);
      const improvementsMatch = content.match(/IMPROVEMENTS:\s*([\s\S]*?)(?=LEARNING:|$)/i);
      const learningMatch = content.match(/LEARNING:\s*([\s\S]*?)$/i);

      const reflexionEntry: ReflexionEntry = {
        id: uuidv4(),
        timestamp: new Date(),
        originalResponse: result.response,
        critique: critiqueMatch ? critiqueMatch[1].trim() : '',
        improvedResponse: improvementsMatch ? improvementsMatch[1].trim() : '',
        learningPoints: learningMatch
          ? learningMatch[1].trim().split('\n').filter(s => s.trim())
          : [],
      };

      this.memory.addReflexion(reflexionEntry);
    } catch (error) {
      console.error('❌ Reflexion error:', error);
    }
  }

  public getAgentId(): string {
    return this.agentId;
  }

  public getAgentType(): string {
    return this.agentType;
  }
}

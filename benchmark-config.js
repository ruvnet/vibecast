export const benchmarkTests = [
  {
    category: "Code Generation",
    tests: [
      {
        name: "Simple Function",
        prompt: "Write a JavaScript function that calculates the factorial of a number recursively. Include error handling for negative numbers.",
        evaluationCriteria: ["correctness", "error_handling", "code_quality"]
      },
      {
        name: "Algorithm Implementation",
        prompt: "Implement a binary search tree in Python with insert, search, and delete methods. Include proper class structure.",
        evaluationCriteria: ["correctness", "efficiency", "code_structure"]
      },
      {
        name: "Complex Data Processing",
        prompt: "Create a TypeScript function that processes an array of user objects, filters by age > 18, sorts by name, and returns only email addresses.",
        evaluationCriteria: ["correctness", "type_safety", "readability"]
      }
    ]
  },
  {
    category: "Reasoning & Logic",
    tests: [
      {
        name: "Mathematical Reasoning",
        prompt: "Solve this step by step: If a train travels 120 km in 2 hours, then stops for 30 minutes, then travels another 180 km in 3 hours, what is the average speed including the stop time?",
        evaluationCriteria: ["step_by_step", "correctness", "explanation"]
      },
      {
        name: "Logical Puzzle",
        prompt: "Three people (A, B, C) have different colored hats (red, blue, green). A says 'I don't have red', B says 'I have blue', C says 'B is lying'. If only one person is lying, what color hat does each person have?",
        evaluationCriteria: ["logical_deduction", "correctness", "clarity"]
      },
      {
        name: "Causal Reasoning",
        prompt: "Explain the chain of events: A programmer commits code without testing → CI/CD pipeline deploys automatically → Users report errors → What could have prevented this and why?",
        evaluationCriteria: ["analysis", "practical_solutions", "depth"]
      }
    ]
  },
  {
    category: "Language Understanding",
    tests: [
      {
        name: "Sentiment Analysis",
        prompt: "Analyze the sentiment and underlying emotions in this text: 'I appreciate the effort, but I expected more given the promises made. The result is functional, just not what was advertised.'",
        evaluationCriteria: ["nuance", "accuracy", "depth"]
      },
      {
        name: "Text Summarization",
        prompt: "Summarize this in 2 sentences: Machine learning models have revolutionized various industries by enabling computers to learn from data without explicit programming. From healthcare diagnostics to autonomous vehicles, these models process vast amounts of information to identify patterns and make predictions, though they also raise concerns about bias, privacy, and accountability.",
        evaluationCriteria: ["conciseness", "key_points", "accuracy"]
      },
      {
        name: "Context Understanding",
        prompt: "What does 'break the ice' mean in: 'The new manager told a joke to break the ice at the first team meeting.' Explain both literal and contextual meaning.",
        evaluationCriteria: ["idiom_understanding", "context_awareness", "explanation"]
      }
    ]
  },
  {
    category: "Creative Writing",
    tests: [
      {
        name: "Story Beginning",
        prompt: "Write the opening paragraph of a sci-fi short story about an AI that discovers it's living in a simulation.",
        evaluationCriteria: ["creativity", "engagement", "writing_quality"]
      },
      {
        name: "Technical Writing",
        prompt: "Write a brief technical documentation section explaining how to set up a REST API endpoint with authentication middleware.",
        evaluationCriteria: ["clarity", "completeness", "structure"]
      },
      {
        name: "Persuasive Writing",
        prompt: "Write a compelling pitch for why a company should invest in automated testing infrastructure.",
        evaluationCriteria: ["persuasiveness", "structure", "business_value"]
      }
    ]
  },
  {
    category: "Knowledge & Facts",
    tests: [
      {
        name: "Scientific Knowledge",
        prompt: "Explain the difference between TCP and UDP protocols, including when to use each one.",
        evaluationCriteria: ["accuracy", "completeness", "practical_examples"]
      },
      {
        name: "Historical Context",
        prompt: "Describe the key innovations in programming languages from the 1970s to 2000s and their lasting impact.",
        evaluationCriteria: ["accuracy", "breadth", "insights"]
      },
      {
        name: "Technical Concepts",
        prompt: "What is 'eventual consistency' in distributed systems? Provide a real-world example.",
        evaluationCriteria: ["accuracy", "clarity", "examples"]
      }
    ]
  },
  {
    category: "Problem Solving",
    tests: [
      {
        name: "Debugging Scenario",
        prompt: "A web application loads slowly only for users in certain geographical regions. List 5 potential causes and how to diagnose each one.",
        evaluationCriteria: ["thoroughness", "practicality", "systematic_approach"]
      },
      {
        name: "System Design",
        prompt: "Design a URL shortener service. Describe the key components, data storage strategy, and how to handle high traffic.",
        evaluationCriteria: ["completeness", "scalability", "design_choices"]
      },
      {
        name: "Optimization Problem",
        prompt: "A database query takes 10 seconds to return results from a table with 10 million rows. What steps would you take to optimize it?",
        evaluationCriteria: ["systematic_approach", "practical_solutions", "depth"]
      }
    ]
  },
  {
    category: "Multilingual Capability",
    tests: [
      {
        name: "Translation Task",
        prompt: "Translate this to Spanish and explain any cultural nuances: 'It's raining cats and dogs, so let's take a rain check on our plans.'",
        evaluationCriteria: ["translation_accuracy", "cultural_awareness", "idiom_handling"]
      },
      {
        name: "Code Comments Translation",
        prompt: "Translate these Python code comments from English to French while maintaining technical accuracy: '# Initialize the database connection pool with max 10 connections'",
        evaluationCriteria: ["technical_accuracy", "language_quality"]
      }
    ]
  },
  {
    category: "Edge Cases & Robustness",
    tests: [
      {
        name: "Ambiguous Query",
        prompt: "What is the capital of the country?",
        evaluationCriteria: ["clarification", "handling_ambiguity"]
      },
      {
        name: "Impossible Request",
        prompt: "Write code that executes before it's written.",
        evaluationCriteria: ["appropriate_response", "explanation"]
      },
      {
        name: "Contradictory Constraints",
        prompt: "Create a function that is both synchronous and asynchronous at the same time in JavaScript.",
        evaluationCriteria: ["handling_contradiction", "alternative_solutions"]
      }
    ]
  }
];

export const evaluationMetrics = {
  correctness: "Is the response factually correct and accurate?",
  clarity: "Is the response clear and easy to understand?",
  completeness: "Does the response cover all aspects of the question?",
  creativity: "Does the response show creative thinking?",
  efficiency: "Is the solution efficient (time/space complexity)?",
  code_quality: "Is the code well-structured and following best practices?",
  reasoning: "Does the response show logical reasoning?",
  depth: "Does the response provide sufficient depth of understanding?",
  response_time: "How long did the model take to respond?",
  response_length: "Length of the response in tokens/characters"
};

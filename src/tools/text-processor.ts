/**
 * Text processing tools for the MCP server
 */
import { McpTool } from '../types';

/**
 * Text summarization tool
 * Provides functionality to summarize text by extracting key sentences
 */
export const summarizeTool: McpTool = {
  name: 'summarize_text',
  description: 'Summarizes text by extracting key sentences based on importance',
  parameters: {
    text: {
      type: 'string',
      description: 'The text to summarize',
      required: true,
    },
    max_sentences: {
      type: 'number',
      description: 'Maximum number of sentences to include in the summary',
      required: false,
      default: 3,
    },
    min_length: {
      type: 'number',
      description: 'Minimum length of sentences to consider',
      required: false,
      default: 10,
    }
  },
  handler: async (params: Record<string, any>) => {
    const { text, max_sentences = 3, min_length = 10 } = params;
    
    if (!text) {
      throw new Error('Text parameter is required');
    }
    
    // Split text into sentences
    const sentences = text
      .replace(/([.?!])\s*(?=[A-Z])/g, "$1|")
      .split("|")
      .filter((sentence: string) => sentence.trim().length >= min_length);
    
    if (sentences.length <= max_sentences) {
      return {
        original_length: text.length,
        summary_length: text.length,
        sentence_count: sentences.length,
        summary: text,
        reduction_percentage: 0
      };
    }
    
    // Simple extractive summarization algorithm
    // Score sentences based on word frequency
    const wordFrequency: Record<string, number> = {};
    const sentenceScores: number[] = [];
    
    // Calculate word frequency
    sentences.forEach((sentence: string) => {
      const words = sentence.toLowerCase().match(/\b\w+\b/g) || [];
      words.forEach((word: string) => {
        if (word.length > 3) { // Ignore short words
          wordFrequency[word] = (wordFrequency[word] || 0) + 1;
        }
      });
    });
    
    // Score sentences based on word frequency
    sentences.forEach((sentence: string, index: number) => {
      let score = 0;
      const words = sentence.toLowerCase().match(/\b\w+\b/g) || [];
      words.forEach((word: string) => {
        if (word.length > 3) {
          score += wordFrequency[word] || 0;
        }
      });
      // Normalize by sentence length to avoid bias towards longer sentences
      score = words.length > 0 ? score / words.length : 0;
      sentenceScores[index] = score;
    });
    
    // Get indices of top scoring sentences
    const topIndices = sentenceScores
      .map((score, index) => ({ score, index }))
      .sort((a, b) => b.score - a.score)
      .slice(0, max_sentences)
      .sort((a, b) => a.index - b.index) // Sort by original position
      .map(item => item.index);
    
    // Create summary from top sentences
    const summary = topIndices.map(index => sentences[index]).join(' ');
    
    return {
      original_length: text.length,
      summary_length: summary.length,
      sentence_count: topIndices.length,
      summary,
      reduction_percentage: Math.round((1 - summary.length / text.length) * 100)
    };
  },
};

/**
 * Text translation tool
 * Provides functionality to translate text between languages
 */
export const translateTool: McpTool = {
  name: 'translate_text',
  description: 'Translates text between languages using a simple dictionary-based approach',
  parameters: {
    text: {
      type: 'string',
      description: 'The text to translate',
      required: true,
    },
    source_language: {
      type: 'string',
      description: 'Source language code (e.g., en, es, fr)',
      required: true,
    },
    target_language: {
      type: 'string',
      description: 'Target language code (e.g., en, es, fr)',
      required: true,
    }
  },
  handler: async (params: Record<string, any>) => {
    const { text, source_language, target_language } = params;
    
    if (!text) {
      throw new Error('Text parameter is required');
    }
    
    if (!source_language) {
      throw new Error('Source language parameter is required');
    }
    
    if (!target_language) {
      throw new Error('Target language parameter is required');
    }
    
    // This is a mock implementation
    // In a real implementation, you would call a translation API
    
    // Simple dictionary for demo purposes
    const dictionaries: Record<string, Record<string, Record<string, string>>> = {
      en: {
        es: {
          'hello': 'hola',
          'world': 'mundo',
          'how': 'cómo',
          'are': 'estás',
          'you': 'tú',
          'today': 'hoy',
          'good': 'bueno',
          'morning': 'mañana',
          'evening': 'tarde',
          'night': 'noche',
          'thank': 'gracias',
          'please': 'por favor',
          'welcome': 'bienvenido'
        },
        fr: {
          'hello': 'bonjour',
          'world': 'monde',
          'how': 'comment',
          'are': 'êtes',
          'you': 'vous',
          'today': 'aujourd\'hui',
          'good': 'bon',
          'morning': 'matin',
          'evening': 'soir',
          'night': 'nuit',
          'thank': 'merci',
          'please': 's\'il vous plaît',
          'welcome': 'bienvenue'
        }
      }
    };
    
    // Check if we support the language pair
    if (!dictionaries[source_language] || !dictionaries[source_language][target_language]) {
      return {
        original_text: text,
        translated_text: text, // Return original if unsupported
        source_language,
        target_language,
        supported: false,
        message: `Translation from ${source_language} to ${target_language} is not supported`
      };
    }
    
    // Simple word-by-word translation
    const dictionary = dictionaries[source_language][target_language];
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const translatedWords = words.map((word: string) => dictionary[word] || word);
    
    // Reconstruct text with translations
    let translatedText = text;
    words.forEach((word: string, index: number) => {
      if (dictionary[word]) {
        // Replace word with translation (case-insensitive)
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        translatedText = translatedText.replace(regex, translatedWords[index]);
      }
    });
    
    return {
      original_text: text,
      translated_text: translatedText,
      source_language,
      target_language,
      supported: true,
      word_count: words.length,
      translated_word_count: words.filter((word: string) => dictionary[word]).length
    };
  },
};
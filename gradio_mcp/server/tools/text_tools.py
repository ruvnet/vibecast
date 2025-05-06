"""
Text processing tools for the MCP server.

This module provides text processing utilities that can be
exposed as tools via the MCP server.
"""

from typing import List, Dict, Union, Optional

def capitalize(text: str) -> str:
    """
    Capitalize the first letter of each word in the text.
    
    Args:
        text: Input text to capitalize
        
    Returns:
        Text with the first letter of each word capitalized
    """
    return text.title()

def word_count(text: str) -> Dict[str, Union[int, List[Dict[str, int]]]]:
    """
    Count the number of words in the text and provide frequency analysis.
    
    Args:
        text: Input text to analyze
        
    Returns:
        Dictionary containing total word count and word frequency analysis
    """
    if not text:
        return {"total": 0, "unique": 0, "frequencies": []}
    
    words = text.split()
    word_freq = {}
    
    for word in words:
        # Remove punctuation for counting
        clean_word = word.strip(".,!?;:\"'()[]{}").lower()
        if clean_word:
            word_freq[clean_word] = word_freq.get(clean_word, 0) + 1
    
    # Convert to sorted list for output
    freq_list = [{"word": word, "count": count} 
                for word, count in sorted(word_freq.items(), 
                                         key=lambda x: x[1], 
                                         reverse=True)]
    
    return {
        "total": len(words),
        "unique": len(word_freq),
        "frequencies": freq_list
    }

def reverse_text(text: str) -> str:
    """
    Reverse the input text.
    
    Args:
        text: Input text to reverse
        
    Returns:
        Reversed text
    """
    return text[::-1]

def summarize(text: str, max_length: Optional[int] = 100) -> str:
    """
    Create a simple summary of the text by truncating to the specified length.
    
    This is a very basic summarization that simply truncates the text to the
    specified maximum length and adds an ellipsis if truncated.
    
    Args:
        text: Input text to summarize
        max_length: Maximum length of the summary (default: 100)
        
    Returns:
        Summarized text
    """
    if not text:
        return ""
    
    if max_length is None or max_length <= 0:
        max_length = 100
    
    if len(text) <= max_length:
        return text
    
    # Try to truncate at a word boundary
    truncated = text[:max_length]
    last_space = truncated.rfind(" ")
    
    if last_space > max_length * 0.8:  # Only truncate at word if it's not too short
        truncated = truncated[:last_space]
    
    return truncated + "..."
"""
Text processor tools for the Gradio MCP implementation.
This module provides text processing utilities.
"""

import re
from typing import List, Optional

def count_words(text: str) -> int:
    """
    Count the number of words in a text.
    
    Args:
        text (str): Input text
        
    Returns:
        int: Number of words
    """
    if not text:
        return 0
    return len(text.split())

def count_characters(text: str, include_spaces: bool = True) -> int:
    """
    Count the number of characters in a text.
    
    Args:
        text (str): Input text
        include_spaces (bool, optional): Whether to include spaces in the count. Defaults to True.
        
    Returns:
        int: Number of characters
    """
    if not text:
        return 0
    if include_spaces:
        return len(text)
    return len(text.replace(" ", ""))

def to_uppercase(text: str) -> str:
    """
    Convert text to uppercase.
    
    Args:
        text (str): Input text
        
    Returns:
        str: Uppercase text
    """
    return text.upper()

def to_lowercase(text: str) -> str:
    """
    Convert text to lowercase.
    
    Args:
        text (str): Input text
        
    Returns:
        str: Lowercase text
    """
    return text.lower()

def reverse_text(text: str) -> str:
    """
    Reverse the characters in a text.
    
    Args:
        text (str): Input text
        
    Returns:
        str: Reversed text
    """
    return text[::-1]

def extract_emails(text: str) -> List[str]:
    """
    Extract email addresses from text.
    
    Args:
        text (str): Input text
        
    Returns:
        List[str]: List of email addresses
    """
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    return re.findall(email_pattern, text)

def summarize_text(text: str, max_length: Optional[int] = 100) -> str:
    """
    Create a simple summary of text by truncating it.
    
    Args:
        text (str): Input text
        max_length (Optional[int], optional): Maximum length of the summary. Defaults to 100.
        
    Returns:
        str: Summarized text
    """
    if not text:
        return ""
    
    if len(text) <= max_length:
        return text
    
    # Find the last space before max_length
    last_space = text[:max_length].rfind(" ")
    if last_space == -1:
        return text[:max_length] + "..."
    
    return text[:last_space] + "..."
"""
Perplexity AI tools for the Gradio MCP implementation.
This module provides tools that integrate with the Perplexity AI API.
"""

import os
import logging
import requests
from typing import Dict, Any, Optional, List, Union

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("gradio_mcp_perplexity")

# Get API key from environment variable
PERPLEXITY_API_KEY = os.environ.get("PERPLEXITY_API_KEY", "")

# API endpoint
PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"

def perplexity_search(
    query: str, 
    system_prompt: Optional[str] = None
) -> str:
    """
    Perform a search using Perplexity AI.
    
    Args:
        query (str): Search query
        system_prompt (Optional[str]): System prompt to guide the search
        
    Returns:
        str: Search results
    """
    if not PERPLEXITY_API_KEY:
        logger.warning("PERPLEXITY_API_KEY environment variable not set")
        return f"Mock results for query: {query}\nSystem prompt: {system_prompt or 'None'}\n(PERPLEXITY_API_KEY not set)"
    
    try:
        headers = {
            "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": "sonar-medium-online",
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt or "You are a helpful assistant that searches the web for information."
                },
                {
                    "role": "user",
                    "content": query
                }
            ]
        }
        
        response = requests.post(PERPLEXITY_API_URL, headers=headers, json=data)
        response.raise_for_status()
        
        result = response.json()
        return result["choices"][0]["message"]["content"]
    
    except Exception as e:
        logger.error(f"Error calling Perplexity API: {str(e)}")
        return f"Error: {str(e)}"

def perplexity_generate(
    prompt: str, 
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 1000
) -> str:
    """
    Generate text using Perplexity AI.
    
    Args:
        prompt (str): User prompt
        system_prompt (Optional[str]): System prompt to guide generation
        temperature (float): Temperature for generation (0.0-1.0)
        max_tokens (int): Maximum number of tokens to generate
        
    Returns:
        str: Generated text
    """
    if not PERPLEXITY_API_KEY:
        logger.warning("PERPLEXITY_API_KEY environment variable not set")
        return f"Mock generated text for prompt: {prompt}\nSystem prompt: {system_prompt or 'None'}\nTemperature: {temperature}\nMax tokens: {max_tokens}\n(PERPLEXITY_API_KEY not set)"
    
    try:
        headers = {
            "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": "mistral-7b-instruct",
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt or "You are a helpful assistant."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        response = requests.post(PERPLEXITY_API_URL, headers=headers, json=data)
        response.raise_for_status()
        
        result = response.json()
        return result["choices"][0]["message"]["content"]
    
    except Exception as e:
        logger.error(f"Error calling Perplexity API: {str(e)}")
        return f"Error: {str(e)}"
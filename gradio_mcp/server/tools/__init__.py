"""
Tools package for the MCP server implementation.

This package contains tool implementations that can be exposed
via the MCP server. Each tool is a Python function with proper
type annotations and docstrings.
"""

from .calculator import add, subtract, multiply, divide
from .text_tools import capitalize, word_count, reverse_text, summarize

__all__ = [
    # Calculator tools
    "add", "subtract", "multiply", "divide",
    
    # Text tools
    "capitalize", "word_count", "reverse_text", "summarize"
]
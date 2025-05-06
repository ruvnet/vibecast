"""
Tools package for the Gradio MCP implementation.
This package contains tools that will be exposed via the MCP server.
"""
from .calculator import (
    add,
    subtract,
    multiply,
    divide,
    power,
    square_root
)

from .text_processor import (
    count_words,
    count_characters,
    to_uppercase,
    to_lowercase,
    reverse_text,
    extract_emails,
    summarize_text
)

from .perplexity import (
    perplexity_search,
    perplexity_generate
)

from .data_science import (
    describe_dataframe,
    correlation_matrix,
    generate_histogram,
    generate_scatter_plot,
    linear_regression,
    kmeans_clustering,
    pca_analysis
)

# Dictionary mapping tool categories to their functions
# This makes it easy to register tools with the MCP server
TOOL_REGISTRY = {
    "calculator": {
        "add": add,
        "subtract": subtract,
        "multiply": multiply,
        "divide": divide,
        "power": power,
        "square_root": square_root
    },
    "text_processor": {
        "count_words": count_words,
        "count_characters": count_characters,
        "to_uppercase": to_uppercase,
        "to_lowercase": to_lowercase,
        "reverse_text": reverse_text,
        "extract_emails": extract_emails,
        "summarize_text": summarize_text
    },
    "perplexity": {
        "search": perplexity_search,
        "generate": perplexity_generate
    }
}

def get_all_tools():
    """
    Returns a flattened dictionary of all available tools.
    
    Returns:
        dict: A dictionary mapping tool names to their function implementations.
    """
    all_tools = {}
    for category, tools in TOOL_REGISTRY.items():
        for tool_name, tool_func in tools.items():
            # Use category prefix to avoid name collisions
            qualified_name = f"{category}_{tool_name}"
            all_tools[qualified_name] = tool_func
    return all_tools

def get_tool_categories():
    """
    Returns the list of available tool categories.
    
    Returns:
        list: A list of tool category names.
    """
    return list(TOOL_REGISTRY.keys())

def get_tools_by_category(category):
    """
    Returns all tools in a specific category.
    
    Args:
        category (str): The category name.
        
    Returns:
        dict: A dictionary mapping tool names to their function implementations.
        
    Raises:
        ValueError: If the category does not exist.
    """
    if category not in TOOL_REGISTRY:
        raise ValueError(f"Category '{category}' does not exist")
    return TOOL_REGISTRY[category].copy()
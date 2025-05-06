"""
Example MCP server implementation using Gradio with Perplexity AI integration.
This demonstrates how to create a simple MCP server using Gradio's built-in MCP support.
"""

import os
import sys
import logging
import gradio as gr
from typing import Dict, Any, List, Optional, Union

# Add the parent directory to the path so we can import the package
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("gradio_mcp_perplexity")

# Calculator functions
def calculator_add(a: float, b: float) -> float:
    """
    Add two numbers together.
    
    Args:
        a (float): First number
        b (float): Second number
        
    Returns:
        float: Sum of a and b
    """
    return a + b

def calculator_subtract(a: float, b: float) -> float:
    """
    Subtract b from a.
    
    Args:
        a (float): First number
        b (float): Second number
        
    Returns:
        float: Difference of a and b
    """
    return a - b

def calculator_multiply(a: float, b: float) -> float:
    """
    Multiply two numbers.
    
    Args:
        a (float): First number
        b (float): Second number
        
    Returns:
        float: Product of a and b
    """
    return a * b

def calculator_divide(a: float, b: float) -> float:
    """
    Divide a by b.
    
    Args:
        a (float): Numerator
        b (float): Denominator
        
    Returns:
        float: Quotient of a and b
        
    Raises:
        ValueError: If b is zero
    """
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a / b

# Text processing functions
def text_processor_count_words(text: str) -> int:
    """
    Count the number of words in a text.
    
    Args:
        text (str): Input text
        
    Returns:
        int: Number of words in the text
    """
    return len(text.split())

def text_processor_count_characters(text: str) -> int:
    """
    Count the number of characters in a text.
    
    Args:
        text (str): Input text
        
    Returns:
        int: Number of characters in the text
    """
    return len(text)

def text_processor_to_uppercase(text: str) -> str:
    """
    Convert text to uppercase.
    
    Args:
        text (str): Input text
        
    Returns:
        str: Uppercase text
    """
    return text.upper()

def text_processor_to_lowercase(text: str) -> str:
    """
    Convert text to lowercase.
    
    Args:
        text (str): Input text
        
    Returns:
        str: Lowercase text
    """
    return text.lower()

# Perplexity AI integration
def perplexity_search(query: str, system_prompt: Optional[str] = None) -> str:
    """
    Perform a search using Perplexity AI.
    
    Args:
        query (str): Search query
        system_prompt (Optional[str]): System prompt to guide the search
        
    Returns:
        str: Search results
    """
    # This is a mock implementation
    # In a real implementation, you would use the Perplexity AI API
    return f"Results for query: {query}\nSystem prompt: {system_prompt or 'None'}"

def perplexity_generate(prompt: str, 
                        system_prompt: Optional[str] = None,
                        temperature: float = 0.7,
                        max_tokens: int = 1000) -> str:
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
    # This is a mock implementation
    # In a real implementation, you would use the Perplexity AI API
    return f"Generated text for prompt: {prompt}\nSystem prompt: {system_prompt or 'None'}\nTemperature: {temperature}\nMax tokens: {max_tokens}"

# Create Gradio Blocks interface
with gr.Blocks(title="Gradio MCP Server with Perplexity AI") as demo:
    gr.Markdown("# Gradio MCP Server with Perplexity AI")
    
    # Calculator Tab
    with gr.Tab("Calculator"):
        gr.Markdown("## Calculator Functions")
        
        with gr.Tab("Add"):
            with gr.Row():
                add_a = gr.Number(label="a")
                add_b = gr.Number(label="b")
            add_result = gr.Number(label="Result")
            add_button = gr.Button("Calculate")
            add_button.click(fn=calculator_add, inputs=[add_a, add_b], outputs=add_result)
        
        with gr.Tab("Subtract"):
            with gr.Row():
                sub_a = gr.Number(label="a")
                sub_b = gr.Number(label="b")
            sub_result = gr.Number(label="Result")
            sub_button = gr.Button("Calculate")
            sub_button.click(fn=calculator_subtract, inputs=[sub_a, sub_b], outputs=sub_result)
        
        with gr.Tab("Multiply"):
            with gr.Row():
                mul_a = gr.Number(label="a")
                mul_b = gr.Number(label="b")
            mul_result = gr.Number(label="Result")
            mul_button = gr.Button("Calculate")
            mul_button.click(fn=calculator_multiply, inputs=[mul_a, mul_b], outputs=mul_result)
        
        with gr.Tab("Divide"):
            with gr.Row():
                div_a = gr.Number(label="a")
                div_b = gr.Number(label="b")
            div_result = gr.Number(label="Result")
            div_button = gr.Button("Calculate")
            div_button.click(fn=calculator_divide, inputs=[div_a, div_b], outputs=div_result)
    
    # Text Processing Tab
    with gr.Tab("Text Processing"):
        gr.Markdown("## Text Processing Functions")
        
        with gr.Tab("Count Words"):
            count_words_text = gr.Textbox(label="Text")
            count_words_result = gr.Number(label="Word Count")
            count_words_button = gr.Button("Count Words")
            count_words_button.click(fn=text_processor_count_words, inputs=count_words_text, outputs=count_words_result)
        
        with gr.Tab("Count Characters"):
            count_chars_text = gr.Textbox(label="Text")
            count_chars_result = gr.Number(label="Character Count")
            count_chars_button = gr.Button("Count Characters")
            count_chars_button.click(fn=text_processor_count_characters, inputs=count_chars_text, outputs=count_chars_result)
        
        with gr.Tab("To Uppercase"):
            to_upper_text = gr.Textbox(label="Text")
            to_upper_result = gr.Textbox(label="Uppercase Text")
            to_upper_button = gr.Button("Convert to Uppercase")
            to_upper_button.click(fn=text_processor_to_uppercase, inputs=to_upper_text, outputs=to_upper_result)
        
        with gr.Tab("To Lowercase"):
            to_lower_text = gr.Textbox(label="Text")
            to_lower_result = gr.Textbox(label="Lowercase Text")
            to_lower_button = gr.Button("Convert to Lowercase")
            to_lower_button.click(fn=text_processor_to_lowercase, inputs=to_lower_text, outputs=to_lower_result)
    
    # Perplexity AI Tab
    with gr.Tab("Perplexity AI"):
        gr.Markdown("## Perplexity AI Integration")
        
        with gr.Tab("Search"):
            search_query = gr.Textbox(label="Search Query")
            search_system_prompt = gr.Textbox(label="System Prompt (Optional)", placeholder="Optional system prompt to guide the search")
            search_result = gr.Textbox(label="Search Results")
            search_button = gr.Button("Search")
            search_button.click(fn=perplexity_search, inputs=[search_query, search_system_prompt], outputs=search_result)
        
        with gr.Tab("Generate"):
            gen_prompt = gr.Textbox(label="Prompt")
            gen_system_prompt = gr.Textbox(label="System Prompt (Optional)", placeholder="Optional system prompt to guide generation")
            gen_temperature = gr.Slider(minimum=0.0, maximum=1.0, value=0.7, label="Temperature")
            gen_max_tokens = gr.Slider(minimum=10, maximum=4000, value=1000, step=10, label="Max Tokens")
            gen_result = gr.Textbox(label="Generated Text")
            gen_button = gr.Button("Generate")
            gen_button.click(fn=perplexity_generate, 
                            inputs=[gen_prompt, gen_system_prompt, gen_temperature, gen_max_tokens], 
                            outputs=gen_result)

if __name__ == "__main__":
    # Launch the server with MCP enabled
    demo.launch(
        server_name="0.0.0.0",  # Listen on all interfaces
        server_port=7861,       # Use a different port
        share=True,             # Create a public link
        mcp_server=True,        # Enable MCP server
        debug=True              # Enable debug mode
    )
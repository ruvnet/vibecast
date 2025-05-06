#!/usr/bin/env python
"""
Gradio MCP Server with Perplexity AI Integration

This example demonstrates how to create a Gradio-based MCP server that integrates with Perplexity AI.
The server exposes calculator, text processing, and Perplexity AI tools via the Model Context Protocol (MCP).
"""

import os
import sys
import json
import logging
import gradio as gr
from typing import Dict, Any, List, Optional, Union, Tuple

# Add the parent directory to the path so we can import the package
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

# Import tools
from gradio_mcp.tools import get_all_tools, get_tool_categories, get_tools_by_category
from gradio_mcp.tools.calculator import add, subtract, multiply, divide
from gradio_mcp.tools.text_processor import count_words, count_characters, to_uppercase, to_lowercase
from gradio_mcp.tools.perplexity import perplexity_search, perplexity_generate

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("gradio_mcp_server")

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
            add_button.click(fn=add, inputs=[add_a, add_b], outputs=add_result)
        
        with gr.Tab("Subtract"):
            with gr.Row():
                sub_a = gr.Number(label="a")
                sub_b = gr.Number(label="b")
            sub_result = gr.Number(label="Result")
            sub_button = gr.Button("Calculate")
            sub_button.click(fn=subtract, inputs=[sub_a, sub_b], outputs=sub_result)
        
        with gr.Tab("Multiply"):
            with gr.Row():
                mul_a = gr.Number(label="a")
                mul_b = gr.Number(label="b")
            mul_result = gr.Number(label="Result")
            mul_button = gr.Button("Calculate")
            mul_button.click(fn=multiply, inputs=[mul_a, mul_b], outputs=mul_result)
        
        with gr.Tab("Divide"):
            with gr.Row():
                div_a = gr.Number(label="a")
                div_b = gr.Number(label="b")
            div_result = gr.Number(label="Result")
            div_button = gr.Button("Calculate")
            div_button.click(fn=divide, inputs=[div_a, div_b], outputs=div_result)
    
    # Text Processing Tab
    with gr.Tab("Text Processing"):
        gr.Markdown("## Text Processing Functions")
        
        with gr.Tab("Count Words"):
            count_words_text = gr.Textbox(label="Text")
            count_words_result = gr.Number(label="Word Count")
            count_words_button = gr.Button("Count Words")
            count_words_button.click(fn=count_words, inputs=count_words_text, outputs=count_words_result)
        
        with gr.Tab("Count Characters"):
            count_chars_text = gr.Textbox(label="Text")
            count_chars_result = gr.Number(label="Character Count")
            count_chars_button = gr.Button("Count Characters")
            count_chars_button.click(fn=count_characters, inputs=count_chars_text, outputs=count_chars_result)
        
        with gr.Tab("To Uppercase"):
            to_upper_text = gr.Textbox(label="Text")
            to_upper_result = gr.Textbox(label="Uppercase Text")
            to_upper_button = gr.Button("Convert to Uppercase")
            to_upper_button.click(fn=to_uppercase, inputs=to_upper_text, outputs=to_upper_result)
        
        with gr.Tab("To Lowercase"):
            to_lower_text = gr.Textbox(label="Text")
            to_lower_result = gr.Textbox(label="Lowercase Text")
            to_lower_button = gr.Button("Convert to Lowercase")
            to_lower_button.click(fn=to_lowercase, inputs=to_lower_text, outputs=to_lower_result)
    
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

# Register all tools for MCP
# Gradio will automatically expose these functions via MCP
# when mcp_server=True is set in launch()

if __name__ == "__main__":
    # Launch the server with MCP enabled
    demo.launch(
        server_name="0.0.0.0",  # Listen on all interfaces
        server_port=7860,       # Default Gradio port
        share=True,             # Create a public link
        debug=True,             # Enable debug mode
        mcp_server=True         # Enable MCP server
    )
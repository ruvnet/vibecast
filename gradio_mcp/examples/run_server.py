#!/usr/bin/env python
"""
Run the Gradio MCP Server with Perplexity AI integration.
"""

import os
import sys
import logging
import argparse

# Add the parent directory to the path so we can import the package
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

# Import the Gradio MCP server
from gradio_mcp_server import demo

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("gradio_mcp_server")

def main():
    """
    Run the Gradio MCP Server with Perplexity AI integration.
    """
    parser = argparse.ArgumentParser(description="Gradio MCP Server with Perplexity AI")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to run the server on")
    parser.add_argument("--port", type=int, default=8080, help="Port to run the server on")
    parser.add_argument("--share", action="store_true", help="Create a public link")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    args = parser.parse_args()
    
    # Launch the server with MCP enabled
    demo.launch(
        server_name=args.host,
        share=args.share,
        debug=args.debug,
        mcp_server=True  # Enable MCP server
    )

if __name__ == "__main__":
    main()
#!/usr/bin/env python
"""
Run the Gradio MCP Server.
"""

import os
import sys
import logging
from argparse import ArgumentParser

# Add the current directory to the path so we can import the package
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from server import GradioMCPServer
from tools import get_all_tools
from config.config import get_server_config

def main():
    """
    Run the Gradio MCP Server.
    """
    # Parse command line arguments
    parser = ArgumentParser(description="Run the Gradio MCP Server")
    parser.add_argument("--host", type=str, help="Host to run the server on")
    parser.add_argument("--port", type=int, help="Port to run the server on")
    parser.add_argument("--debug", action="store_true", help="Run in debug mode")
    parser.add_argument("--log-level", type=str, choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
                        help="Logging level")
    args = parser.parse_args()

    # Get server config
    config = get_server_config()

    # Override config with command line arguments
    if args.host:
        config["host"] = args.host
    if args.port:
        config["port"] = args.port
    if args.debug:
        config["debug"] = args.debug
    if args.log_level:
        config["log_level"] = args.log_level

    # Configure logging
    logging.basicConfig(
        level=getattr(logging, config["log_level"]),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    # Create server
    server = GradioMCPServer(config=config)

    # Register tools
    tools = get_all_tools()
    for tool_name, tool_func in tools.items():
        server.register_tool(tool_name, tool_func)

    # Launch server
    server.launch(share=True)

if __name__ == "__main__":
    main()
#!/usr/bin/env python
"""
Run a simple client to test the Gradio MCP Server.
"""

import os
import sys
import logging
from argparse import ArgumentParser

# Add the parent directory to the path so we can import the package
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from src.gradio_mcp.client import GradioMCPClient
from src.gradio_mcp.config.config import get_client_config

def main():
    """
    Run a simple client to test the Gradio MCP Server.
    """
    # Parse command line arguments
    parser = ArgumentParser(description="Run a simple client to test the Gradio MCP Server")
    parser.add_argument("--server-url", type=str, help="URL of the server")
    parser.add_argument("--timeout", type=int, help="Timeout for requests")
    parser.add_argument("--retry-count", type=int, help="Number of retries for failed requests")
    parser.add_argument("--retry-delay", type=int, help="Delay between retries")
    parser.add_argument("--log-level", type=str, choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
                        help="Logging level")
    args = parser.parse_args()

    # Get client config
    config = get_client_config()

    # Override config with command line arguments
    if args.server_url:
        config["server_url"] = args.server_url
    if args.timeout:
        config["timeout"] = args.timeout
    if args.retry_count:
        config["retry_count"] = args.retry_count
    if args.retry_delay:
        config["retry_delay"] = args.retry_delay
    if args.log_level:
        config["log_level"] = args.log_level

    # Configure logging
    logging.basicConfig(
        level=getattr(logging, config["log_level"]),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    # Create client
    client = GradioMCPClient(config=config)

    # List available tools
    print("Available tools:")
    tools = client.list_tools()
    for tool_name in tools:
        print(f"- {tool_name}")
        schema = client.get_tool_schema(tool_name)
        print(f"  Description: {schema.get('description', 'No description')}")
        print(f"  Parameters: {schema.get('parameters', {})}")
        print()

    # Execute a tool if available
    if tools:
        tool_name = tools[0]
        print(f"Executing tool: {tool_name}")
        
        # Get the schema for the tool
        schema = client.get_tool_schema(tool_name)
        
        # Prepare parameters based on the schema
        params = {}
        if "parameters" in schema and "properties" in schema["parameters"]:
            for param_name, param_schema in schema["parameters"]["properties"].items():
                # Use default value if available, otherwise use a placeholder value based on the type
                if "default" in param_schema:
                    params[param_name] = param_schema["default"]
                elif param_schema.get("type") == "string":
                    params[param_name] = "test_value"
                elif param_schema.get("type") == "number" or param_schema.get("type") == "integer":
                    params[param_name] = 42
                elif param_schema.get("type") == "boolean":
                    params[param_name] = True
                elif param_schema.get("type") == "array":
                    params[param_name] = []
                elif param_schema.get("type") == "object":
                    params[param_name] = {}
        
        # Execute the tool
        result = client.execute_tool(tool_name, params)
        print(f"Result: {result}")

if __name__ == "__main__":
    main()
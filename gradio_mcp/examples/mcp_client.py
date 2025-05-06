#!/usr/bin/env python
"""
MCP Client for testing the Gradio MCP Server with Perplexity AI integration.
This client uses the MCP protocol to communicate with the Gradio MCP server.
"""

import os
import sys
import json
import logging
import argparse
import requests
import subprocess
import time
from typing import Dict, Any, List, Optional, Union

# Add the parent directory to the path so we can import the package
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("gradio_mcp_client")

def run_mcp_client(server_url: str, tool_name: str, params: Dict[str, Any]) -> Any:
    """
    Run the MCP client using the mcp-remote CLI tool.
    
    Args:
        server_url (str): The URL of the MCP server.
        tool_name (str): The name of the tool to execute.
        params (Dict[str, Any]): The parameters to pass to the tool.
        
    Returns:
        Any: The result of the tool execution.
    """
    # Construct the MCP server URL
    mcp_url = f"{server_url}/gradio_api/mcp/sse"
    logger.info(f"Connecting to MCP server at {mcp_url}")
    
    # Create a temporary file for the parameters
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(params, f)
        params_file = f.name
    
    try:
        # Run the mcp-remote command
        cmd = [
            "npx", "mcp-remote",
            "--server", mcp_url,
            "--tool", tool_name,
            "--params-file", params_file
        ]
        logger.info(f"Running command: {' '.join(cmd)}")
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            logger.error(f"Error executing tool {tool_name}: {result.stderr}")
            return None
        
        # Parse the output
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            logger.warning("Could not parse JSON output, returning raw output")
            return result.stdout
    
    finally:
        # Clean up the temporary file
        if os.path.exists(params_file):
            os.unlink(params_file)

def main():
    """
    Run the MCP client.
    """
    parser = argparse.ArgumentParser(description="MCP Client")
    parser.add_argument("--server", type=str, default="http://localhost:7860", help="MCP server URL")
    parser.add_argument("--list-tools", action="store_true", help="List available tools")
    parser.add_argument("--tool", type=str, help="Tool to execute")
    parser.add_argument("--params", type=str, help="Parameters for the tool (JSON string)")
    args = parser.parse_args()
    
    # Create client
    client = MCPClient(args.server)
    
    # List tools
    if args.list_tools:
        tools = client.list_tools()
        print(f"Available tools ({len(tools)}):")
        for tool in tools:
            print(f"  - {tool['name']}: {tool['description']}")
            print(f"    Input schema: {json.dumps(tool['input_schema'], indent=2)}")
            print()
    
    # Execute tool
    if args.tool:
        params = {}
        if args.params:
            try:
                params = json.loads(args.params)
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON parameters: {args.params}")
                return
        
        result = client.execute_tool(args.tool, params)
        print(f"Result: {result}")

if __name__ == "__main__":
    main()
#!/usr/bin/env python
"""
Simple client to test the Gradio MCP Server.
"""

import os
import sys
import logging
import argparse
import requests
import json
from typing import Dict, Any, List, Optional, Union

# Add the parent directory to the path so we can import the package
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("gradio_mcp_client")

class MCPClient:
    """
    Simple MCP client to test the Gradio MCP Server.
    """
    
    def __init__(self, server_url: str = "http://127.0.0.1:7860"):
        """
        Initialize the MCP client.
        
        Args:
            server_url (str): URL of the MCP server
        """
        self.server_url = server_url
        logger.info(f"Initialized MCP client with server URL: {server_url}")
    
    def list_tools(self) -> List[str]:
        """
        List all available tools on the MCP server.
        
        Returns:
            List[str]: List of tool names
        """
        response = requests.get(f"{self.server_url}/mcp/tools")
        response.raise_for_status()
        return response.json()
    
    def get_tool_schema(self, tool_name: str) -> Dict[str, Any]:
        """
        Get the schema for a specific tool.
        
        Args:
            tool_name (str): Name of the tool
            
        Returns:
            Dict[str, Any]: Tool schema
        """
        response = requests.get(f"{self.server_url}/mcp/tools/{tool_name}")
        response.raise_for_status()
        return response.json()
    
    def execute_tool(self, tool_name: str, parameters: Dict[str, Any]) -> Any:
        """
        Execute a tool on the MCP server.
        
        Args:
            tool_name (str): Name of the tool
            parameters (Dict[str, Any]): Tool parameters
            
        Returns:
            Any: Tool result
        """
        response = requests.post(
            f"{self.server_url}/mcp/tools/{tool_name}/execute",
            json={"parameters": parameters}
        )
        response.raise_for_status()
        return response.json()["result"]

def main():
    """
    Main function to run the MCP client.
    """
    parser = argparse.ArgumentParser(description="MCP Client")
    parser.add_argument("--server-url", type=str, default="http://127.0.0.1:7860", help="URL of the MCP server")
    parser.add_argument("--list-tools", action="store_true", help="List all available tools")
    parser.add_argument("--tool", type=str, help="Tool to execute")
    parser.add_argument("--parameters", type=str, help="Tool parameters as JSON string")
    args = parser.parse_args()
    
    client = MCPClient(server_url=args.server_url)
    
    if args.list_tools:
        tools = client.list_tools()
        print("Available tools:")
        for tool in tools:
            schema = client.get_tool_schema(tool)
            print(f"  {tool}: {schema.get('description', 'No description')}")
    
    if args.tool:
        parameters = {}
        if args.parameters:
            parameters = json.loads(args.parameters)
        
        print(f"Executing tool: {args.tool}")
        print(f"Parameters: {parameters}")
        
        result = client.execute_tool(args.tool, parameters)
        print(f"Result: {result}")

if __name__ == "__main__":
    main()
"""
Gradio MCP Client implementation.
This module provides a client that connects to MCP servers and uses their tools.
"""

import os
import json
import logging
import requests
from typing import Dict, Any, List, Optional, Union, Callable

from gradio_mcp.config.config import get_client_config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("gradio_mcp_client")

class GradioMCPClient:
    """
    A client that connects to MCP servers and uses their tools.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the Gradio MCP Client.
        
        Args:
            config (Optional[Dict[str, Any]], optional): Client configuration. Defaults to None.
        """
        # Load default configuration
        self.config = get_client_config()
        
        # Update with provided configuration if any
        if config:
            self.config.update(config)
        
        # Set log level from configuration
        logger.setLevel(self.config.get("log_level", "INFO"))
        
        # Initialize session
        self.session = requests.Session()
        
        # Initialize tools cache
        self.tools_cache = {}
        
        logger.info(f"Initialized Gradio MCP Client with config: {self.config}")
    
    def _get_server_url(self) -> str:
        """
        Get the server URL from the configuration.
        
        Returns:
            str: The server URL.
        """
        return self.config["server_url"].rstrip("/")
    
    def _make_request(self, method: str, endpoint: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Make a request to the MCP server.
        
        Args:
            method (str): The HTTP method (GET, POST, etc.).
            endpoint (str): The endpoint to request.
            data (Optional[Dict[str, Any]], optional): The data to send. Defaults to None.
            
        Returns:
            Dict[str, Any]: The response from the server.
            
        Raises:
            Exception: If the request fails.
        """
        url = f"{self._get_server_url()}{endpoint}"
        
        # Set up request kwargs
        kwargs = {
            "timeout": self.config["timeout"],
            "verify": self.config["ssl_verify"]
        }
        
        # Add data if provided
        if data:
            kwargs["json"] = data
        
        # Make the request with retries
        for attempt in range(self.config["retry_count"] + 1):
            try:
                response = self.session.request(method, url, **kwargs)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.warning(f"Request failed (attempt {attempt + 1}/{self.config['retry_count'] + 1}): {e}")
                if attempt == self.config["retry_count"]:
                    raise
                import time
                time.sleep(self.config["retry_delay"])
    
    def get_server_info(self) -> Dict[str, Any]:
        """
        Get information about the MCP server.
        
        Returns:
            Dict[str, Any]: Information about the server.
        """
        return self._make_request("GET", "/")
    
    def list_tools(self) -> List[str]:
        """
        List all tools available on the MCP server.
        
        Returns:
            List[str]: A list of available tool names.
        """
        try:
            response = self._make_request("GET", "/api/mcp_tools")
            return response
        except:
            # Try alternative endpoint
            try:
                response = self._make_request("GET", "/mcp_tools")
                return response
            except:
                try:
                    # Try another alternative endpoint
                    response = self._make_request("GET", "/api/tools")
                    return response
                except:
                    try:
                        # Try another alternative endpoint
                        response = self._make_request("GET", "/tools")
                        return response
                    except:
                        # Try another alternative endpoint
                        response = self._make_request("GET", "/")
                        return list(response.get("tools", {}).keys())
    
    def get_tool_schema(self, tool_name: str) -> Dict[str, Any]:
        """
        Get the schema for a specific tool.
        
        Args:
            tool_name (str): The name of the tool.
            
        Returns:
            Dict[str, Any]: The tool schema.
            
        Raises:
            ValueError: If the tool does not exist.
        """
        # Check cache first
        if tool_name in self.tools_cache:
            return self.tools_cache[tool_name]
        
        # If not in cache, fetch from server
        try:
            response = self._make_request("POST", "/api/mcp_tool_schema", {
                "tool_name": tool_name
            })
        except:
            try:
                # Try alternative endpoint
                response = self._make_request("GET", f"/api/mcp_tool_schema?tool_name={tool_name}")
            except:
                try:
                    # Try another alternative endpoint
                    response = self._make_request("GET", f"/mcp_tool_schema?tool_name={tool_name}")
                except:
                    # Return a minimal schema
                    response = {
                        "name": tool_name,
                        "description": "",
                        "parameters": {
                            "type": "object",
                            "properties": {},
                            "required": []
                        }
                    }
        
        # Cache the tool
        self.tools_cache[tool_name] = response
        
        return response
    
    def execute_tool(self, tool_name: str, parameters: Dict[str, Any]) -> Any:
        """
        Execute a tool on the MCP server.
        
        Args:
            tool_name (str): The name of the tool.
            parameters (Dict[str, Any]): The parameters to pass to the tool.
            
        Returns:
            Any: The result of the tool execution.
            
        Raises:
            ValueError: If the tool does not exist or the parameters are invalid.
        """
        # Get the tool schema to validate parameters
        schema = self.get_tool_schema(tool_name)
        
        # Validate required parameters
        required_params = schema.get("parameters", {}).get("required", [])
        for param in required_params:
            if param not in parameters:
                raise ValueError(f"Missing required parameter: {param}")
        
        # Execute the tool
        try:
            response = self._make_request("POST", "/api/mcp_execute_tool", {
                "tool_name": tool_name,
                "params": parameters
            })
            return response.get("result", response)
        except:
            try:
                # Try alternative endpoint
                response = self._make_request("POST", "/mcp_execute_tool", {
                    "tool_name": tool_name,
                    "params": parameters
                })
                return response.get("result", response)
            except:
                try:
                    # Try direct function call
                    response = self._make_request("POST", f"/{tool_name}", parameters)
                    return response
                except Exception as e:
                    raise Exception(f"Failed to execute tool {tool_name}: {str(e)}")
    
    def create_tool_function(self, tool_name: str) -> Callable:
        """
        Create a Python function that wraps a tool on the MCP server.
        
        Args:
            tool_name (str): The name of the tool.
            
        Returns:
            Callable: A function that executes the tool.
        """
        # Get the tool schema
        schema = self.get_tool_schema(tool_name)
        
        # Create a wrapper function
        def tool_function(**kwargs):
            return self.execute_tool(tool_name, kwargs)
        
        # Set function metadata
        tool_function.__name__ = tool_name
        tool_function.__doc__ = schema.get("description", "")
        
        return tool_function
    
    def create_all_tool_functions(self) -> Dict[str, Callable]:
        """
        Create Python functions for all tools on the MCP server.
        
        Returns:
            Dict[str, Callable]: A dictionary mapping tool names to functions.
        """
        tools = self.list_tools()
        return {tool["name"]: self.create_tool_function(tool["name"]) for tool in tools}
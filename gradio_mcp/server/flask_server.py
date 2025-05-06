"""
Flask server for exposing MCP endpoints.
"""

import os
import logging
import inspect
from typing import Dict, Any, Callable, List, Optional, Union
from flask import Flask, request, jsonify
from mcp import Tool

from src.gradio_mcp.config.config import get_server_config, get_tool_config
from src.gradio_mcp.tools import get_all_tools, get_tool_categories, get_tools_by_category

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("gradio_mcp_flask_server")

class FlaskMCPServer:
    """
    A server that exposes tools via the Model Context Protocol (MCP) using Flask.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the Flask MCP Server.
        
        Args:
            config (Optional[Dict[str, Any]], optional): Server configuration. Defaults to None.
        """
        # Load default configuration
        self.config = get_server_config()
        
        # Update with provided configuration if any
        if config:
            self.config.update(config)
        
        # Set log level from configuration
        logger.setLevel(self.config.get("log_level", "INFO"))
        
        # Initialize Flask app
        self.app = Flask(__name__)
        
        # Initialize tools registry
        self.tools = {}
        
        # Initialize tool config
        self.tool_config = get_tool_config()
        
        # Register routes
        self._register_routes()
    
    def register_tool(self, name: str, tool_func: Callable) -> None:
        """
        Register a tool with the MCP server.
        
        Args:
            name (str): The name of the tool.
            tool_func (Callable): The function that implements the tool.
        """
        self.tools[name] = tool_func
        logger.info(f"Registered tool: {name}")
    
    def _register_routes(self) -> None:
        """
        Register routes with the Flask app.
        """
        # Root route
        @self.app.route('/')
        def index():
            return jsonify({
                "name": self.config["server_name"],
                "description": self.config["description"],
                "version": "1.0.0"
            })
        
        # List tools
        @self.app.route('/mcp/tools')
        def list_tools():
            return jsonify(list(self.tools.keys()))
        
        # Get tool schema
        @self.app.route('/mcp/tools/<tool_name>')
        def get_tool_schema(tool_name):
            if tool_name not in self.tools:
                return jsonify({"error": f"Tool '{tool_name}' not found"}), 404
            
            return jsonify(self._generate_tool_schema(self.tools[tool_name]))
        
        # Execute tool
        @self.app.route('/mcp/tools/<tool_name>/execute', methods=['POST'])
        def execute_tool(tool_name):
            if tool_name not in self.tools:
                return jsonify({"error": f"Tool '{tool_name}' not found"}), 404
            
            try:
                data = request.json
                params = data.get("parameters", {})
                result = self.tools[tool_name](**params)
                return jsonify({"result": result})
            except Exception as e:
                return jsonify({"error": str(e)}), 400
    
    def _generate_tool_schema(self, tool_func: Callable) -> Dict[str, Any]:
        """
        Generate a schema for a tool function.
        
        Args:
            tool_func (Callable): The function that implements the tool.
            
        Returns:
            Dict[str, Any]: The schema for the tool.
        """
        # Get function signature
        sig = inspect.signature(tool_func)
        
        # Get function docstring
        doc = inspect.getdoc(tool_func) or ""
        
        # Generate schema
        schema = {
            "name": tool_func.__name__,
            "description": doc,
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
        
        # Add parameters to schema
        for name, param in sig.parameters.items():
            # Skip self parameter
            if name == "self":
                continue
            
            # Get parameter type
            param_type = "string"
            if param.annotation != inspect.Parameter.empty:
                if param.annotation == int:
                    param_type = "integer"
                elif param.annotation == float:
                    param_type = "number"
                elif param.annotation == bool:
                    param_type = "boolean"
                elif param.annotation == list:
                    param_type = "array"
                elif param.annotation == dict:
                    param_type = "object"
            
            # Add parameter to schema
            schema["parameters"]["properties"][name] = {
                "type": param_type,
                "description": ""
            }
            
            # Add required parameter
            if param.default == inspect.Parameter.empty:
                schema["parameters"]["required"].append(name)
        
        return schema
    
    def run(self, host: Optional[str] = None, port: Optional[int] = None, debug: Optional[bool] = None) -> None:
        """
        Run the Flask MCP server.
        
        Args:
            host (Optional[str], optional): Host to run the server on. Defaults to None.
            port (Optional[int], optional): Port to run the server on. Defaults to None.
            debug (Optional[bool], optional): Whether to run in debug mode. Defaults to None.
        """
        # Get host, port, and debug from config if not provided
        host = host or self.config.get("host", "127.0.0.1")
        port = port or self.config.get("port", 7860)
        debug = debug or self.config.get("debug", False)
        
        # Run the Flask app
        self.app.run(host=host, port=port, debug=debug)
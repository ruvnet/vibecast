"""
Gradio MCP Server implementation.
This module provides a server that exposes tools via the Model Context Protocol (MCP).
"""

import os
import logging
import inspect
import gradio as gr
from typing import Dict, Any, Callable, List, Optional, Union
from mcp import Tool

from ..config.config import get_server_config, get_tool_config
from ..tools import get_all_tools, get_tool_categories, get_tools_by_category

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("gradio_mcp_server")

class GradioMCPServer:
    """
    A server that exposes tools via the Model Context Protocol (MCP) using Gradio.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the Gradio MCP Server.
        
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
        
        # Initialize Gradio blocks
        self.blocks = gr.Blocks()
        
        # Initialize tools registry
        self.tools = {}
        
        # Tool configuration
        self.tool_config = get_tool_config()
        
        logger.info(f"Initialized Gradio MCP Server with config: {self.config}")
    
    def register_tool(self, name: str, fn: Callable = None, tool_func: Callable = None, description: str = None, parameters: Dict[str, Any] = None) -> None:
        """
        Register a tool with the MCP server.
        
        Args:
            name (str): The name of the tool.
            fn (Callable, optional): The tool function (alternative to tool_func). Defaults to None.
            tool_func (Callable, optional): The tool function. Defaults to None.
            description (str, optional): The tool description. Defaults to None.
            parameters (Dict[str, Any], optional): The tool parameters schema. Defaults to None.
            
        Raises:
            ValueError: If a tool with the same name is already registered.
            ValueError: If neither fn nor tool_func is provided.
        """
        if name in self.tools:
            raise ValueError(f"Tool '{name}' is already registered")
        
        # Use fn if provided, otherwise use tool_func
        func = fn if fn is not None else tool_func
        
        if func is None:
            raise ValueError("Either fn or tool_func must be provided")
        
        self.tools[name] = func
        logger.info(f"Registered tool: {name}")
    
    def register_tools_from_dict(self, tools_dict: Dict[str, Callable]) -> None:
        """
        Register multiple tools from a dictionary.
        
        Args:
            tools_dict (Dict[str, Callable]): A dictionary mapping tool names to functions.
        """
        for name, func in tools_dict.items():
            self.register_tool(name, func)
    
    def register_tools_from_category(self, category: str) -> None:
        """
        Register all tools from a specific category.
        
        Args:
            category (str): The category name.
            
        Raises:
            ValueError: If the category does not exist.
        """
        tools = get_tools_by_category(category)
        for name, func in tools.items():
            qualified_name = f"{category}_{name}"
            self.register_tool(qualified_name, func)
    
    def register_all_tools(self) -> None:
        """
        Register all available tools.
        """
        tools = get_all_tools()
        self.register_tools_from_dict(tools)
    
    def _generate_tool_schema(self, tool_func: Callable) -> Dict[str, Any]:
        """
        Generate a JSON schema for a tool function.
        
        Args:
            tool_func (Callable): The tool function.
            
        Returns:
            Dict[str, Any]: The JSON schema for the tool.
        """
        # Get function signature
        sig = inspect.signature(tool_func)
        
        # Get function docstring
        doc = inspect.getdoc(tool_func) or ""
        
        # Create schema
        schema = {
            "name": tool_func.__name__,
            "description": doc.split("\n\n")[0] if doc else "",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            },
            "returns": {}
        }
        
        # Add parameters to schema
        for param_name, param in sig.parameters.items():
            # Skip self parameter for methods
            if param_name == "self":
                continue
            
            # Get parameter type
            param_type = param.annotation if param.annotation != inspect.Parameter.empty else Any
            
            # Convert type to JSON schema type
            json_type = "string"
            if param_type in (int, float):
                json_type = "number"
            elif param_type == bool:
                json_type = "boolean"
            elif param_type == list or param_type == List:
                json_type = "array"
            elif param_type == dict or param_type == Dict:
                json_type = "object"
            
            # Add parameter to schema
            schema["parameters"]["properties"][param_name] = {
                "type": json_type,
                "description": ""  # Could extract from docstring in a more advanced implementation
            }
            
            # Add to required parameters if no default value
            if param.default == inspect.Parameter.empty:
                schema["parameters"]["required"].append(param_name)
        
        # Add return type to schema
        return_type = sig.return_annotation if sig.return_annotation != inspect.Signature.empty else Any
        json_return_type = "string"
        if return_type in (int, float):
            json_return_type = "number"
        elif return_type == bool:
            json_return_type = "boolean"
        elif return_type == list or return_type == List:
            json_return_type = "array"
        elif return_type == dict or return_type == Dict:
            json_return_type = "object"
        
        schema["returns"] = {
            "type": json_return_type
        }
        
        return schema
    
    def _create_inputs_from_schema(self, schema: Dict[str, Any]) -> List[gr.components.Component]:
        """
        Create Gradio input components from a tool schema.
        
        Args:
            schema (Dict[str, Any]): The tool schema.
            
        Returns:
            List[gr.components.Component]: A list of Gradio input components.
        """
        inputs = []
        
        if "parameters" in schema and "properties" in schema["parameters"]:
            for param_name, param_schema in schema["parameters"]["properties"].items():
                param_type = param_schema.get("type", "string")
                param_description = param_schema.get("description", "")
                
                if param_type == "string":
                    inputs.append(gr.Textbox(label=param_name, info=param_description))
                elif param_type == "number" or param_type == "integer":
                    inputs.append(gr.Number(label=param_name, info=param_description))
                elif param_type == "boolean":
                    inputs.append(gr.Checkbox(label=param_name, info=param_description))
                elif param_type == "array":
                    inputs.append(gr.Textbox(label=param_name, info=f"{param_description} (comma-separated values)"))
                elif param_type == "object":
                    inputs.append(gr.JSON(label=param_name, info=param_description))
                else:
                    inputs.append(gr.Textbox(label=param_name, info=param_description))
        
        return inputs
    
    def _create_outputs_from_schema(self, schema: Dict[str, Any]) -> List[gr.components.Component]:
        """
        Create Gradio output components from a tool schema.
        
        Args:
            schema (Dict[str, Any]): The tool schema.
            
        Returns:
            List[gr.components.Component]: A list of Gradio output components.
        """
        if "returns" in schema:
            return_type = schema["returns"].get("type", "string")
            
            if return_type == "string":
                return [gr.Textbox(label="Result")]
            elif return_type == "number" or return_type == "integer":
                return [gr.Number(label="Result")]
            elif return_type == "boolean":
                return [gr.Checkbox(label="Result")]
            elif return_type == "array":
                return [gr.JSON(label="Result")]
            elif return_type == "object":
                return [gr.JSON(label="Result")]
            else:
                return [gr.Textbox(label="Result")]
        
        return [gr.Textbox(label="Result")]
    
    def _get_examples_for_tool(self, tool_name: str) -> List[List[Any]]:
        """
        Get examples for a tool.
        
        Args:
            tool_name (str): The name of the tool.
            
        Returns:
            List[List[Any]]: A list of examples for the tool.
        """
        # Get examples from the tool config
        tool_config = self.tool_config.get(tool_name, {})
        examples = tool_config.get("examples", [])
        
        return examples
    
    def _build_mcp_interface(self) -> None:
        """
        Build the MCP interface using Gradio.
        """
        with self.blocks:
            # Create MCP endpoints for each tool
            for tool_name, tool_func in self.tools.items():
                # Generate schema for the tool
                schema = self._generate_tool_schema(tool_func)
                
                # Create Tool instance
                tool = Tool(
                    name=tool_name,
                    description=schema["description"],
                    inputSchema=schema["parameters"]
                )
                
                # Register the tool with Gradio
                gr.Interface(
                    fn=tool_func,
                    inputs=self._create_inputs_from_schema(schema),
                    outputs=self._create_outputs_from_schema(schema),
                    title=tool_name,
                    description=schema["description"],
                    examples=self._get_examples_for_tool(tool_name)
                )
            
            # Add MCP API endpoints
            with gr.Blocks() as mcp_api:
                @mcp_api.load(api_name="mcp_tools")
                def list_tools():
                    """
                    List all available tools.
                    """
                    return list(self.tools.keys())
                
                @mcp_api.load(api_name="mcp_tool_schema")
                def get_tool_schema(tool_name: str):
                    """
                    Get the schema for a tool.
                    """
                    if tool_name not in self.tools:
                        return {"error": f"Tool '{tool_name}' not found"}, 404
                    
                    return self._generate_tool_schema(self.tools[tool_name])
                
                @mcp_api.load(api_name="mcp_execute_tool")
                def execute_tool(tool_name: str, params: Dict[str, Any]):
                    """
                    Execute a tool.
                    """
                    if tool_name not in self.tools:
                        return {"error": f"Tool '{tool_name}' not found"}, 404
                    
                    try:
                        result = self.tools[tool_name](**params)
                        return {"result": result}
                    except Exception as e:
                        return {"error": str(e)}, 400
    
    def launch(self, **kwargs) -> None:
        """
        Launch the MCP server.
        
        Args:
            **kwargs: Additional arguments to pass to gr.Blocks.launch().
        """
        # Build the MCP interface
        self._build_mcp_interface()
        
        # Merge configuration with kwargs
        launch_kwargs = {
            "server_name": self.config["host"],
            "server_port": self.config["port"],
            "debug": self.config["debug"]
        }
        launch_kwargs.update(kwargs)
        
        # Launch the server
        logger.info(f"Launching Gradio MCP Server on {self.config['host']}:{self.config['port']}")
        self.blocks.launch(**launch_kwargs)
    
    def get_app(self):
        """
        Get the Gradio app for use with other WSGI servers.
        
        Returns:
            The Gradio app.
        """
        # Build the MCP interface
        self._build_mcp_interface()
        
        # Return the app
        return self.blocks.app
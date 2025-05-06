"""
Utility functions for the MCP server implementation.
"""

import importlib
import inspect
import logging
import os
import sys
from typing import Dict, List, Callable, Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("gradio_mcp.server.utils")

def load_tools(tools_dir: str = None, 
               tool_modules: List[str] = None) -> Dict[str, Callable]:
    """
    Load tool functions from specified modules or directory.
    
    Args:
        tools_dir: Directory containing tool modules (optional)
        tool_modules: List of module names to import tools from (optional)
        
    Returns:
        Dictionary mapping tool names to tool functions
    
    At least one of tools_dir or tool_modules must be provided.
    """
    if not tools_dir and not tool_modules:
        raise ValueError("Either tools_dir or tool_modules must be provided")
    
    tools = {}
    
    # Load tools from directory
    if tools_dir:
        logger.info(f"Loading tools from directory: {tools_dir}")
        sys.path.insert(0, os.path.dirname(tools_dir))
        
        for filename in os.listdir(tools_dir):
            if filename.endswith(".py") and not filename.startswith("__"):
                module_name = filename[:-3]  # Remove .py extension
                try:
                    module = importlib.import_module(f"{os.path.basename(tools_dir)}.{module_name}")
                    tools.update(_extract_tools_from_module(module))
                except Exception as e:
                    logger.error(f"Error loading module {module_name}: {e}")
        
        sys.path.pop(0)
    
    # Load tools from specified modules
    if tool_modules:
        logger.info(f"Loading tools from modules: {tool_modules}")
        for module_name in tool_modules:
            try:
                module = importlib.import_module(module_name)
                tools.update(_extract_tools_from_module(module))
            except Exception as e:
                logger.error(f"Error loading module {module_name}: {e}")
    
    logger.info(f"Loaded {len(tools)} tools: {', '.join(tools.keys())}")
    return tools

def _extract_tools_from_module(module) -> Dict[str, Callable]:
    """
    Extract tool functions from a module.
    
    A function is considered a tool if:
    1. It's not private (doesn't start with _)
    2. It has type annotations for all parameters
    3. It has a docstring
    
    Args:
        module: The module to extract tools from
        
    Returns:
        Dictionary mapping tool names to tool functions
    """
    tools = {}
    
    for name, obj in inspect.getmembers(module):
        # Skip private functions and non-functions
        if name.startswith("_") or not inspect.isfunction(obj):
            continue
        
        # Skip functions without docstrings
        if not obj.__doc__:
            logger.warning(f"Skipping function {name} because it has no docstring")
            continue
        
        # Check if all parameters have type annotations
        sig = inspect.signature(obj)
        if not all(param.annotation != inspect.Parameter.empty 
                  for param in sig.parameters.values()):
            logger.warning(f"Skipping function {name} because not all parameters have type annotations")
            continue
        
        # Add the function as a tool
        tools[name] = obj
        logger.debug(f"Added tool: {name}")
    
    return tools

def validate_tool_input(tool_func: Callable, inputs: Dict[str, Any]) -> Optional[str]:
    """
    Validate inputs for a tool function based on its signature.
    
    Args:
        tool_func: The tool function to validate inputs for
        inputs: Dictionary of input values
        
    Returns:
        Error message if validation fails, None if validation succeeds
    """
    sig = inspect.signature(tool_func)
    
    # Check for missing required parameters
    for param_name, param in sig.parameters.items():
        if param.default == inspect.Parameter.empty and param_name not in inputs:
            return f"Missing required parameter: {param_name}"
    
    # Check for extra parameters
    for param_name in inputs:
        if param_name not in sig.parameters:
            return f"Unknown parameter: {param_name}"
    
    # Check parameter types (basic validation)
    for param_name, param in sig.parameters.items():
        if param_name in inputs and inputs[param_name] is not None:
            # Skip type checking for parameters with default None
            if param.default is None:
                continue
                
            # Get the expected type
            expected_type = param.annotation
            if expected_type == inspect.Parameter.empty:
                continue
                
            # Handle Union types (e.g., Union[str, int])
            if hasattr(expected_type, "__origin__") and expected_type.__origin__ is not None:
                if not any(isinstance(inputs[param_name], t) for t in expected_type.__args__):
                    return f"Parameter {param_name} has invalid type. Expected one of {expected_type.__args__}, got {type(inputs[param_name])}"
            # Handle regular types
            elif not isinstance(inputs[param_name], expected_type):
                return f"Parameter {param_name} has invalid type. Expected {expected_type}, got {type(inputs[param_name])}"
    
    return None
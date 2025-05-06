"""
Utility functions for the MCP client implementation.
"""

import json
import logging
import requests
import time
from typing import Dict, List, Any, Optional, Union

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("gradio_mcp.client.utils")

def fetch_tool_schema(server_url: str, timeout: int = 30) -> List[Dict[str, Any]]:
    """
    Fetch the schema of tools available on an MCP server.
    
    Args:
        server_url: URL of the MCP server
        timeout: Request timeout in seconds
        
    Returns:
        List of tool schemas
    """
    # Ensure the URL ends with a slash
    if not server_url.endswith("/"):
        server_url += "/"
    
    # Append the MCP schema endpoint
    schema_url = f"{server_url}gradio_api/mcp/schema"
    
    logger.info(f"Fetching tool schema from {schema_url}")
    
    try:
        response = requests.get(schema_url, timeout=timeout)
        response.raise_for_status()
        
        schema = response.json()
        logger.info(f"Successfully fetched schema with {len(schema)} tools")
        return schema
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching tool schema: {e}")
        return []

def call_tool(server_url: str, 
              tool_name: str, 
              inputs: Dict[str, Any], 
              timeout: int = 30,
              retry_count: int = 3,
              retry_delay: int = 1) -> Dict[str, Any]:
    """
    Call a tool on an MCP server.
    
    Args:
        server_url: URL of the MCP server
        tool_name: Name of the tool to call
        inputs: Dictionary of input values
        timeout: Request timeout in seconds
        retry_count: Number of retries for failed requests
        retry_delay: Delay between retries in seconds
        
    Returns:
        Dictionary containing the tool response
    """
    # Ensure the URL ends with a slash
    if not server_url.endswith("/"):
        server_url += "/"
    
    # Append the MCP tool endpoint
    tool_url = f"{server_url}gradio_api/mcp/tools/{tool_name}"
    
    logger.info(f"Calling tool {tool_name} at {tool_url}")
    
    for attempt in range(retry_count + 1):
        try:
            response = requests.post(
                tool_url,
                json={"inputs": inputs},
                timeout=timeout,
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            
            result = response.json()
            logger.info(f"Successfully called tool {tool_name}")
            return result
        
        except requests.exceptions.RequestException as e:
            logger.warning(f"Error calling tool {tool_name} (attempt {attempt+1}/{retry_count+1}): {e}")
            
            if attempt < retry_count:
                logger.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                logger.error(f"Failed to call tool {tool_name} after {retry_count+1} attempts")
                return {"error": str(e)}

def parse_tool_response(response: Dict[str, Any]) -> Union[Any, Dict[str, str]]:
    """
    Parse the response from an MCP tool call.
    
    Args:
        response: Response from the tool call
        
    Returns:
        Parsed response or error message
    """
    if "error" in response:
        return {"error": response["error"]}
    
    if "data" in response:
        return response["data"]
    
    return response
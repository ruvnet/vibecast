"""
Server-Sent Events (SSE) implementation for the Gradio MCP server.
This module provides SSE functionality for the MCP protocol.
"""

import asyncio
import json
import logging
from typing import Dict, Any, List, Optional, Union, AsyncGenerator
from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("gradio_mcp_sse")

# Create router
router = APIRouter()

async def event_generator(request: Request, tool_name: str, params: Dict[str, Any]) -> AsyncGenerator[str, None]:
    """
    Generate SSE events for tool execution.
    
    Args:
        request (Request): The FastAPI request object
        tool_name (str): The name of the tool to execute
        params (Dict[str, Any]): The parameters for the tool
        
    Yields:
        str: SSE events
    """
    # Send start event
    yield json.dumps({
        "event": "start",
        "data": {
            "tool": tool_name,
            "params": params
        }
    })
    
    try:
        # Import tools dynamically to avoid circular imports
        from src.gradio_mcp.tools import get_all_tools
        
        all_tools = get_all_tools()
        if tool_name not in all_tools:
            yield json.dumps({
                "event": "error",
                "data": {
                    "message": f"Tool '{tool_name}' not found"
                }
            })
            return
        
        # Execute tool
        result = all_tools[tool_name](**params)
        
        # If the result is a generator, stream the results
        if hasattr(result, '__iter__') and not isinstance(result, (str, bytes, dict, list)):
            for item in result:
                if await request.is_disconnected():
                    logger.info("Client disconnected")
                    break
                
                yield json.dumps({
                    "event": "data",
                    "data": item
                })
                await asyncio.sleep(0.1)  # Small delay to avoid flooding
        else:
            # Send result as a single event
            yield json.dumps({
                "event": "data",
                "data": result
            })
        
        # Send complete event
        yield json.dumps({
            "event": "complete",
            "data": {}
        })
    
    except Exception as e:
        logger.error(f"Error executing tool '{tool_name}': {str(e)}")
        yield json.dumps({
            "event": "error",
            "data": {
                "message": str(e)
            }
        })

@router.post("/mcp/v1/tools/{tool_name}/sse")
async def execute_tool_sse(tool_name: str, request: Request) -> StreamingResponse:
    """
    Execute a tool and stream the results using SSE.
    
    Args:
        tool_name (str): The name of the tool to execute
        request (Request): The FastAPI request
        
    Returns:
        StreamingResponse: An SSE streaming response
    """
    try:
        # Parse request body
        body = await request.json()
        
        # Create event source response
        return EventSourceResponse(
            event_generator(request, tool_name, body),
            media_type="text/event-stream"
        )
    
    except Exception as e:
        logger.error(f"Error setting up SSE for tool '{tool_name}': {str(e)}")
        return Response(
            content=json.dumps({"error": str(e)}),
            media_type="application/json",
            status_code=400
        )
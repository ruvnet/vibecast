"""
Server package for the Gradio MCP implementation.
This package provides a server for exposing tools via the MCP protocol.
"""

from .server import GradioMCPServer as MCPServer

__all__ = ["MCPServer"]
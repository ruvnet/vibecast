"""
Tests for the Gradio MCP Client implementation.
"""

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add the parent directory to the Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from client import GradioMCPClient
from config.config import get_client_config

class TestGradioMCPClient(unittest.TestCase):
    """
    Test cases for the GradioMCPClient class.
    """
    
    def setUp(self):
        """
        Set up the test environment.
        """
        # Create a client instance for testing
        self.client = GradioMCPClient()
    
    def test_client_initialization(self):
        """
        Test that the client initializes correctly.
        """
        # Check that the client has the expected attributes
        self.assertIsNotNone(self.client.config)
        self.assertIsNotNone(self.client.session)
        self.assertIsNotNone(self.client.tools_cache)
    
    def test_get_server_url(self):
        """
        Test that the client returns the correct server URL.
        """
        # Get the server URL
        url = self.client._get_server_url()
        
        # Check that the URL is correct
        self.assertEqual(url, self.client.config["server_url"].rstrip("/"))
    
    @patch("requests.Session.request")
    def test_make_request(self, mock_request):
        """
        Test that the client can make requests to the server.
        """
        # Set up the mock response
        mock_response = MagicMock()
        mock_response.json.return_value = {"result": "test"}
        mock_request.return_value = mock_response
        
        # Make a request
        result = self.client._make_request("GET", "/test")
        
        # Check that the request was made correctly
        mock_request.assert_called_once()
        self.assertEqual(result, {"result": "test"})
    
    @patch("requests.Session.request")
    def test_list_tools(self, mock_request):
        """
        Test that the client can list tools from the server.
        """
        # Set up the mock response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "tools": [
                {
                    "name": "test_tool",
                    "description": "A test tool",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "a": {"type": "number"},
                            "b": {"type": "number"}
                        },
                        "required": ["a", "b"]
                    },
                    "returns": {"type": "number"}
                }
            ]
        }
        mock_request.return_value = mock_response
        
        # List the tools
        tools = self.client.list_tools()
        
        # Check that the tools were listed correctly
        self.assertEqual(len(tools), 1)
        self.assertEqual(tools[0]["name"], "test_tool")
        self.assertEqual(tools[0]["description"], "A test tool")
        
        # Check that the tool was cached
        self.assertIn("test_tool", self.client.tools_cache)
    
    @patch("requests.Session.request")
    def test_get_tool_schema(self, mock_request):
        """
        Test that the client can get the schema for a tool.
        """
        # Set up the mock response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "name": "test_tool",
            "description": "A test tool",
            "parameters": {
                "type": "object",
                "properties": {
                    "a": {"type": "number"},
                    "b": {"type": "number"}
                },
                "required": ["a", "b"]
            },
            "returns": {"type": "number"}
        }
        mock_request.return_value = mock_response
        
        # Get the schema
        schema = self.client.get_tool_schema("test_tool")
        
        # Check that the schema was retrieved correctly
        self.assertEqual(schema["name"], "test_tool")
        self.assertEqual(schema["description"], "A test tool")
        
        # Check that the tool was cached
        self.assertIn("test_tool", self.client.tools_cache)
    
    @patch("requests.Session.request")
    def test_execute_tool(self, mock_request):
        """
        Test that the client can execute a tool on the server.
        """
        # Set up the mock responses for get_tool_schema and execute_tool
        mock_responses = [
            # Response for get_tool_schema
            MagicMock(json=lambda: {
                "name": "test_tool",
                "description": "A test tool",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "a": {"type": "number"},
                        "b": {"type": "number"}
                    },
                    "required": ["a", "b"]
                },
                "returns": {"type": "number"}
            }),
            # Response for execute_tool
            MagicMock(json=lambda: {"result": 3})
        ]
        mock_request.side_effect = mock_responses
        
        # Execute the tool
        result = self.client.execute_tool("test_tool", {"a": 1, "b": 2})
        
        # Check that the tool was executed correctly
        self.assertEqual(result, 3)
    
    @patch("requests.Session.request")
    def test_execute_tool_missing_parameter(self, mock_request):
        """
        Test that executing a tool with missing parameters raises an error.
        """
        # Set up the mock response for get_tool_schema
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "name": "test_tool",
            "description": "A test tool",
            "parameters": {
                "type": "object",
                "properties": {
                    "a": {"type": "number"},
                    "b": {"type": "number"}
                },
                "required": ["a", "b"]
            },
            "returns": {"type": "number"}
        }
        mock_request.return_value = mock_response
        
        # Try to execute the tool with missing parameters
        with self.assertRaises(ValueError):
            self.client.execute_tool("test_tool", {"a": 1})
    
    @patch("requests.Session.request")
    def test_create_tool_function(self, mock_request):
        """
        Test that the client can create a function that wraps a tool.
        """
        # Set up the mock response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "name": "test_tool",
            "description": "A test tool",
            "parameters": {
                "type": "object",
                "properties": {
                    "a": {"type": "number"},
                    "b": {"type": "number"}
                },
                "required": ["a", "b"]
            },
            "returns": {"type": "number"}
        }
        mock_request.return_value = mock_response
        
        # Create the tool function
        tool_function = self.client.create_tool_function("test_tool")
        
        # Check that the function has the expected metadata
        self.assertEqual(tool_function.__name__, "test_tool")
        self.assertEqual(tool_function.__doc__, "A test tool")

if __name__ == "__main__":
    unittest.main()
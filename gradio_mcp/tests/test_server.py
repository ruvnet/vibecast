"""
Tests for the Gradio MCP Server implementation.
"""

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add the parent directory to the Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from server import GradioMCPServer
from config.config import get_server_config

class TestGradioMCPServer(unittest.TestCase):
    """
    Test cases for the GradioMCPServer class.
    """
    
    def setUp(self):
        """
        Set up the test environment.
        """
        # Create a server instance for testing
        self.server = GradioMCPServer()
    
    def test_server_initialization(self):
        """
        Test that the server initializes correctly.
        """
        # Check that the server has the expected attributes
        self.assertIsNotNone(self.server.config)
        self.assertIsNotNone(self.server.blocks)
        self.assertIsNotNone(self.server.tools)
        self.assertIsNotNone(self.server.tool_config)
    
    def test_register_tool(self):
        """
        Test that tools can be registered with the server.
        """
        # Define a test tool
        def test_tool(a, b):
            return a + b
        
        # Register the tool
        self.server.register_tool("test_tool", test_tool)
        
        # Check that the tool was registered
        self.assertIn("test_tool", self.server.tools)
        self.assertEqual(self.server.tools["test_tool"], test_tool)
    
    def test_register_duplicate_tool(self):
        """
        Test that registering a duplicate tool raises an error.
        """
        # Define a test tool
        def test_tool(a, b):
            return a + b
        
        # Register the tool
        self.server.register_tool("test_tool", test_tool)
        
        # Try to register the tool again
        with self.assertRaises(ValueError):
            self.server.register_tool("test_tool", test_tool)
    
    def test_generate_tool_schema(self):
        """
        Test that the server can generate a schema for a tool.
        """
        # Define a test tool with type annotations and docstring
        def test_tool(a: int, b: int) -> int:
            """
            Add two numbers together.
            
            Args:
                a (int): First number
                b (int): Second number
                
            Returns:
                int: The sum of a and b
            """
            return a + b
        
        # Generate the schema
        schema = self.server._generate_tool_schema(test_tool)
        
        # Check that the schema has the expected structure
        self.assertEqual(schema["name"], "test_tool")
        self.assertEqual(schema["description"], "Add two numbers together.")
        self.assertIn("parameters", schema)
        self.assertIn("properties", schema["parameters"])
        self.assertIn("a", schema["parameters"]["properties"])
        self.assertIn("b", schema["parameters"]["properties"])
        self.assertIn("required", schema["parameters"])
        self.assertIn("a", schema["parameters"]["required"])
        self.assertIn("b", schema["parameters"]["required"])
        self.assertIn("returns", schema)
        self.assertEqual(schema["returns"]["type"], "number")
    
    @patch("gradio.Blocks.launch")
    def test_launch(self, mock_launch):
        """
        Test that the server can be launched.
        """
        # Register a test tool
        def test_tool(a, b):
            return a + b
        
        self.server.register_tool("test_tool", test_tool)
        
        # Launch the server
        self.server.launch()
        
        # Check that the launch method was called
        mock_launch.assert_called_once()

if __name__ == "__main__":
    unittest.main()
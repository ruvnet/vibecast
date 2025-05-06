"""
Configuration settings for the Gradio MCP implementation.
"""

# Server configuration
SERVER_CONFIG = {
    "host": "127.0.0.1",  # Server host
    "port": 7860,         # Server port
    "server_name": "gradio-mcp-example",  # Server name for identification
    "debug": True,        # Enable debug mode
    "auth": None,         # Authentication (None for no auth, or tuple of (username, password))
    "ssl_keyfile": None,  # Path to SSL key file (None for HTTP)
    "ssl_certfile": None, # Path to SSL certificate file (None for HTTP)
}

# Client configuration
CLIENT_CONFIG = {
    "server_url": "http://127.0.0.1:7860",  # URL of the MCP server
    "timeout": 30,        # Request timeout in seconds
    "retry_count": 3,     # Number of retries for failed requests
    "retry_delay": 1,     # Delay between retries in seconds
}

# Tool configuration
TOOL_CONFIG = {
    "calculator": {
        "enabled": True,  # Enable/disable the calculator tool
        "description": "Perform basic arithmetic operations",
        "examples": [
            {"num1": 5, "num2": 3, "operation": "add"},
            {"num1": 10, "num2": 2, "operation": "divide"}
        ]
    },
    "text_tools": {
        "enabled": True,  # Enable/disable the text tools
        "description": "Text processing utilities",
        "examples": [
            {"text": "hello world", "operation": "capitalize"},
            {"text": "This is a sample text", "operation": "word_count"}
        ]
    }
}

# UI configuration
UI_CONFIG = {
    "title": "Gradio MCP Example",
    "description": "A basic example of Gradio MCP implementation",
    "theme": "default",
    "layout": "panel",  # Options: "panel", "horizontal", "vertical"
    "show_api": True,   # Show API documentation
}
"""
Configuration module for the Gradio MCP implementation.
This module provides configuration utilities for the server and tools.
"""

import os
import json
import logging
from typing import Dict, Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("gradio_mcp_config")

# Default server configuration
DEFAULT_SERVER_CONFIG = {
    "host": "0.0.0.0",
    "port": 7860,
    "debug": False,
    "log_level": "INFO"
}

# Default client configuration
DEFAULT_CLIENT_CONFIG = {
    "server_url": "http://localhost:7860/mcp",
    "timeout": 30,
    "ssl_verify": True,
    "retry_count": 3,
    "retry_delay": 1,
    "log_level": "INFO"
}

# Default tool configuration
DEFAULT_TOOL_CONFIG = {
    "calculator_add": {
        "examples": [
            [1, 2],
            [10, 20],
            [100, 200]
        ]
    },
    "calculator_subtract": {
        "examples": [
            [10, 5],
            [100, 50],
            [1000, 500]
        ]
    },
    "calculator_multiply": {
        "examples": [
            [2, 3],
            [10, 10],
            [100, 100]
        ]
    },
    "calculator_divide": {
        "examples": [
            [10, 2],
            [100, 10],
            [1000, 100]
        ]
    },
    "text_processor_count_words": {
        "examples": [
            ["Hello, world!"],
            ["This is a test sentence."],
            ["One two three four five."]
        ]
    },
    "text_processor_count_characters": {
        "examples": [
            ["Hello, world!"],
            ["This is a test sentence."],
            ["One two three four five."]
        ]
    },
    "text_processor_to_uppercase": {
        "examples": [
            ["Hello, world!"],
            ["This is a test sentence."],
            ["Mixed Case Text."]
        ]
    },
    "text_processor_to_lowercase": {
        "examples": [
            ["HELLO, WORLD!"],
            ["THIS IS A TEST SENTENCE."],
            ["Mixed Case Text."]
        ]
    },
    "perplexity_search": {
        "examples": [
            ["What is the capital of France?", "You are a helpful assistant."],
            ["Who won the World Cup in 2022?", "You are a sports expert."],
            ["Explain quantum computing", "You are a quantum physics expert."]
        ]
    },
    "perplexity_generate": {
        "examples": [
            ["Write a short poem about nature.", "You are a poet."],
            ["Explain how to make pasta.", "You are a chef."],
            ["Write a short story about space travel.", "You are a science fiction author."]
        ]
    }
}

def get_server_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Get the server configuration.
    
    Args:
        config_path (Optional[str], optional): Path to the configuration file. Defaults to None.
        
    Returns:
        Dict[str, Any]: Server configuration
    """
    config = DEFAULT_SERVER_CONFIG.copy()
    
    # Update from environment variables
    if "GRADIO_MCP_HOST" in os.environ:
        config["host"] = os.environ["GRADIO_MCP_HOST"]
    if "GRADIO_MCP_PORT" in os.environ:
        config["port"] = int(os.environ["GRADIO_MCP_PORT"])
    if "GRADIO_MCP_DEBUG" in os.environ:
        config["debug"] = os.environ["GRADIO_MCP_DEBUG"].lower() in ("true", "1", "yes")
    if "GRADIO_MCP_LOG_LEVEL" in os.environ:
        config["log_level"] = os.environ["GRADIO_MCP_LOG_LEVEL"]
    
    # Update from configuration file
    if config_path and os.path.exists(config_path):
        try:
            with open(config_path, "r") as f:
                file_config = json.load(f)
                config.update(file_config)
        except Exception as e:
            logger.error(f"Error loading configuration from {config_path}: {str(e)}")
    
    return config

def get_tool_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Get the tool configuration.
    
    Args:
        config_path (Optional[str], optional): Path to the configuration file. Defaults to None.
        
    Returns:
        Dict[str, Any]: Tool configuration
    """
    config = DEFAULT_TOOL_CONFIG.copy()
    
    # Update from configuration file
    if config_path and os.path.exists(config_path):
        try:
            with open(config_path, "r") as f:
                file_config = json.load(f)
                config.update(file_config)
        except Exception as e:
            logger.error(f"Error loading tool configuration from {config_path}: {str(e)}")
    
    return config

def get_client_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Get the client configuration.
    
    Args:
        config_path (Optional[str], optional): Path to the configuration file. Defaults to None.
        
    Returns:
        Dict[str, Any]: Client configuration
    """
    config = DEFAULT_CLIENT_CONFIG.copy()
    
    # Update from environment variables
    if "GRADIO_MCP_SERVER_URL" in os.environ:
        config["server_url"] = os.environ["GRADIO_MCP_SERVER_URL"]
    if "GRADIO_MCP_TIMEOUT" in os.environ:
        config["timeout"] = int(os.environ["GRADIO_MCP_TIMEOUT"])
    if "GRADIO_MCP_SSL_VERIFY" in os.environ:
        config["ssl_verify"] = os.environ["GRADIO_MCP_SSL_VERIFY"].lower() in ("true", "1", "yes")
    if "GRADIO_MCP_RETRY_COUNT" in os.environ:
        config["retry_count"] = int(os.environ["GRADIO_MCP_RETRY_COUNT"])
    if "GRADIO_MCP_RETRY_DELAY" in os.environ:
        config["retry_delay"] = float(os.environ["GRADIO_MCP_RETRY_DELAY"])
    if "GRADIO_MCP_LOG_LEVEL" in os.environ:
        config["log_level"] = os.environ["GRADIO_MCP_LOG_LEVEL"]
    
    # Update from configuration file
    if config_path and os.path.exists(config_path):
        try:
            with open(config_path, "r") as f:
                file_config = json.load(f)
                config.update(file_config)
        except Exception as e:
            logger.error(f"Error loading client configuration from {config_path}: {str(e)}")
    
    return config
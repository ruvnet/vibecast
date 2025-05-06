# Gradio MCP Server with Perplexity AI Integration

This package provides a Gradio-based MCP (Model Context Protocol) server that integrates with Perplexity AI. It allows you to expose various tools via the MCP protocol, including calculator functions, text processing utilities, and Perplexity AI search and generation capabilities.

## Features

- **Gradio UI**: User-friendly interface for interacting with tools
- **MCP Protocol**: Expose tools via the Model Context Protocol
- **Tool Categories**:
  - **Calculator**: Basic arithmetic operations
  - **Text Processing**: Word counting, character counting, case conversion, etc.
  - **Perplexity AI**: Search and text generation using Perplexity AI

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/gradio-mcp.git
cd gradio-mcp

# Install dependencies
pip install -r requirements.txt
```

## Usage

### Running the Server

```bash
# Set your Perplexity API key (optional)
export PERPLEXITY_API_KEY="your-api-key"

# Run the server
python src/gradio_mcp/examples/run_server.py
```

Server options:
- `--host`: Host to run the server on (default: 0.0.0.0)
- `--port`: Port to run the server on (default: 7860)
- `--share`: Create a public link
- `--debug`: Enable debug mode

### Using the Client

```bash
# List available tools
python src/gradio_mcp/examples/mcp_client.py --list-tools

# Execute a calculator tool
python src/gradio_mcp/examples/mcp_client.py --tool calculator_add --params '{"a": 5, "b": 3}'

# Execute a text processing tool
python src/gradio_mcp/examples/mcp_client.py --tool text_processor_count_words --params '{"text": "Hello, world!"}'

# Execute a Perplexity AI search
python src/gradio_mcp/examples/mcp_client.py --tool perplexity_search --params '{"query": "What is the capital of France?"}'
```

## MCP Protocol

The server implements the Model Context Protocol (MCP), which allows AI models to interact with tools and resources. The MCP endpoints are:

- `GET /mcp/v1/tools`: List all available tools
- `POST /mcp/v1/tools/{tool_name}`: Execute a tool

## Adding New Tools

To add new tools, create a new module in the `src/gradio_mcp/tools` directory and update the `TOOL_REGISTRY` in `src/gradio_mcp/tools/__init__.py`.

Example:

```python
# src/gradio_mcp/tools/my_tools.py
def my_new_tool(param1, param2):
    """
    Description of my new tool.
    
    Args:
        param1: Description of param1
        param2: Description of param2
        
    Returns:
        The result
    """
    # Tool implementation
    return f"Result: {param1}, {param2}"

# Update src/gradio_mcp/tools/__init__.py
from src.gradio_mcp.tools.my_tools import my_new_tool

TOOL_REGISTRY = {
    # Existing categories...
    "my_category": {
        "my_new_tool": my_new_tool
    }
}
```

## License

MIT
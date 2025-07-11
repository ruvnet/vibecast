Here's a complete "Hello World" MCP server implementation using Python's official SDK with stdio transport, tool discovery, and inline documentation:

```python
"""
MCP Hello World Server
Demonstrates basic Model Context Protocol implementation with:
- Tool exposure (greeting capability)
- Stdio transport for local execution
- Protocol-compliant discovery mechanisms
"""

import asyncio
from mcp.server.lowlevel import Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    Tool,
    ToolParameter,
    ToolResult,
    TextContent,
    InitializationOptions
)

# Initialize MCP server with basic metadata
server = Server("HelloWorldServer")

@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    """Return available tools during discovery phase"""
    return [
        Tool(
            name="greet",
            description="Generates greeting messages",
            parameters={
                "name": ToolParameter(
                    type="string",
                    description="Recipient's name",
                    required=True
                )
            },
        )
    ]

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict) -> ToolResult:
    """Execute requested tool with provided arguments"""
    if name == "greet":
        # Safely extract and process arguments
        recipient = arguments.get("name", "World").strip()
        return ToolResult(
            content=[TextContent(type="text", text=f"Hello, {recipient}!")]
        )
    raise ValueError(f"Unknown tool: {name}")

async def main():
    """Main execution loop with stdio transport setup"""
    async with stdio_server() as (input_stream, output_stream):
        await server.run(
            input_stream,
            output_stream,
            InitializationOptions(
                server_name="HelloWorldServer",
                server_version="0.1.0",
                capabilities=server.get_capabilities()
            )
        )

if __name__ == "__main__":
    asyncio.run(main())
```

**Key Components Explained:**

1. **Server Initialization**  
   `Server("HelloWorldServer")` creates an MCP-compliant server instance with basic identification.

2. **Tool Discovery**  
   `@server.list_tools` decorator registers the discovery handler that advertises the `greet` tool's interface[1][2].

3. **Tool Execution**  
   `@server.call_tool` handles incoming tool execution requests, validating inputs and generating greetings[1][4].

4. **Stdio Transport**  
   `stdio_server()` configures standard input/output communication following MCP's streaming protocol[1][2].

**Usage Instructions:**

1. Install dependencies:  
   ```bash
   pip install "mcp[cli]"
   ```

2. Save as `server.py` and run:  
   ```bash
   python server.py
   ```

3. Test with MCP Inspector:  
   ```bash
   mcp dev server.py
   ```

This implementation provides a foundation for extending with additional tools, resources, and prompt templates while maintaining protocol compliance. The server can be integrated with any MCP client through stdio or adapted for SSE transport[2][4].

Citations:
[1] https://github.com/modelcontextprotocol/python-sdk
[2] https://github.com/cyanheads/model-context-protocol-resources/blob/main/guides/mcp-server-development-guide.md
[3] https://community.aws/content/2uFvyCPQt7KcMxD9ldsJyjZM1Wp/model-context-protocol-mcp-and-amazon-bedrock?lang=en
[4] https://blog.stackademic.com/model-context-protocol-mcp-in-ai-9858b5ecd9ce
[5] https://www.philschmid.de/mcp-introduction
[6] https://www.youtube.com/watch?v=oq3dkNm51qc
[7] https://daily.dev/blog/what-is-mcp-model-context-protocol
[8] https://www.datacamp.com/tutorial/mcp-model-context-protocol

---
Answer from Perplexity: pplx.ai/share
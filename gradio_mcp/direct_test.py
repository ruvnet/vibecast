#!/usr/bin/env python
"""
Direct test script for the Gradio MCP Server.
This script runs the perplexity_mcp_server.py example directly.
"""

import os
import sys
import subprocess
import time

def main():
    """
    Run the perplexity_mcp_server.py example directly.
    """
    # Get the path to the examples directory
    examples_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "examples")
    
    # Run the perplexity_mcp_server.py example
    server_path = os.path.join(examples_dir, "perplexity_mcp_server.py")
    
    print(f"Running {server_path}...")
    
    # Set environment variable for a different port
    env = os.environ.copy()
    env["GRADIO_SERVER_PORT"] = "7861"  # Use a different port
    
    # Start the server process
    server_process = subprocess.Popen(
        [sys.executable, server_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env
    )
    
    # Wait for the server to start
    print("Waiting for server to start...")
    time.sleep(5)
    
    # Check if the server is running
    if server_process.poll() is None:
        print("Server is running!")
        print("Press Ctrl+C to stop the server.")
        try:
            # Wait for the server to finish
            server_process.wait()
        except KeyboardInterrupt:
            # Stop the server
            print("Stopping server...")
            server_process.terminate()
            server_process.wait()
    else:
        # Server failed to start
        stdout, stderr = server_process.communicate()
        print("Server failed to start!")
        print("STDOUT:")
        print(stdout)
        print("STDERR:")
        print(stderr)
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
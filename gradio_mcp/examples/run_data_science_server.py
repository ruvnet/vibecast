"""
Script to run the data science MCP server.
"""

import os
import sys
import subprocess
import argparse

# Add the parent directory to the path so we can import the package
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

def main():
    parser = argparse.ArgumentParser(description="Run the data science MCP server")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    parser.add_argument("--share", action="store_true", help="Enable sharing")
    parser.add_argument("--port", type=int, default=7860, help="Port to run the server on")
    
    args = parser.parse_args()
    
    # Get the path to the data_science_mcp_server.py file
    server_path = os.path.join(os.path.dirname(__file__), "data_science_mcp_server.py")
    
    # Build the command
    cmd = [sys.executable, server_path]
    if args.debug:
        cmd.append("--debug")
    if args.share:
        cmd.append("--share")
    if args.port != 7860:
        cmd.extend(["--port", str(args.port)])
    
    # Run the server
    subprocess.run(cmd)

if __name__ == "__main__":
    main()
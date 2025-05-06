"""
Script to run the tests for the Gradio MCP implementation.
"""

import os
import sys
import unittest
import os
from pathlib import Path

# Add the current directory to the Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

def run_tests():
    """
    Run all tests for the Gradio MCP implementation.
    """
    # Discover and run all tests
    test_loader = unittest.TestLoader()
    test_suite = test_loader.discover(
        start_dir=os.path.join(os.path.dirname(__file__), "tests"),
        pattern="test_*.py"
    )
    
    # Run the tests
    test_runner = unittest.TextTestRunner(verbosity=2)
    result = test_runner.run(test_suite)
    
    # Return the result
    return result.wasSuccessful()

if __name__ == "__main__":
    # Run the tests
    success = run_tests()
    
    # Exit with appropriate status code
    sys.exit(0 if success else 1)
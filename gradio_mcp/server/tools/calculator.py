"""
Calculator tools for the MCP server.

This module provides basic arithmetic operations that can be
exposed as tools via the MCP server.
"""

from typing import Union, Literal

Number = Union[int, float]

def add(num1: Number, num2: Number) -> Number:
    """
    Add two numbers together.
    
    Args:
        num1: First number
        num2: Second number
        
    Returns:
        Sum of the two numbers
    """
    return num1 + num2

def subtract(num1: Number, num2: Number) -> Number:
    """
    Subtract the second number from the first.
    
    Args:
        num1: First number
        num2: Second number to subtract from the first
        
    Returns:
        Result of num1 - num2
    """
    return num1 - num2

def multiply(num1: Number, num2: Number) -> Number:
    """
    Multiply two numbers together.
    
    Args:
        num1: First number
        num2: Second number
        
    Returns:
        Product of the two numbers
    """
    return num1 * num2

def divide(num1: Number, num2: Number) -> Union[Number, str]:
    """
    Divide the first number by the second.
    
    Args:
        num1: Numerator
        num2: Denominator
        
    Returns:
        Result of division or error message if dividing by zero
    """
    if num2 == 0:
        return "Error: Cannot divide by zero"
    return num1 / num2

def calculator(num1: Number, 
               num2: Number, 
               operation: Literal["add", "subtract", "multiply", "divide"]) -> Union[Number, str]:
    """
    Perform a basic arithmetic operation on two numbers.
    
    Args:
        num1: First number
        num2: Second number
        operation: The operation to perform (add, subtract, multiply, divide)
        
    Returns:
        Result of the operation or error message
    """
    if operation == "add":
        return add(num1, num2)
    elif operation == "subtract":
        return subtract(num1, num2)
    elif operation == "multiply":
        return multiply(num1, num2)
    elif operation == "divide":
        return divide(num1, num2)
    else:
        return f"Error: Unknown operation '{operation}'"
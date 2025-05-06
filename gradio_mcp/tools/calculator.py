"""
Calculator tools for the Gradio MCP implementation.
This module provides basic arithmetic operations.
"""

def add(a: float, b: float) -> float:
    """
    Add two numbers.
    
    Args:
        a (float): First number
        b (float): Second number
        
    Returns:
        float: Sum of a and b
    """
    return a + b

def subtract(a: float, b: float) -> float:
    """
    Subtract b from a.
    
    Args:
        a (float): First number
        b (float): Second number
        
    Returns:
        float: Difference of a and b (a - b)
    """
    return a - b

def multiply(a: float, b: float) -> float:
    """
    Multiply two numbers.
    
    Args:
        a (float): First number
        b (float): Second number
        
    Returns:
        float: Product of a and b
    """
    return a * b

def divide(a: float, b: float) -> float:
    """
    Divide a by b.
    
    Args:
        a (float): Numerator
        b (float): Denominator
        
    Returns:
        float: Quotient of a and b (a / b)
        
    Raises:
        ZeroDivisionError: If b is zero
    """
    if b == 0:
        raise ZeroDivisionError("Cannot divide by zero")
    return a / b

def power(base: float, exponent: float) -> float:
    """
    Raise base to the power of exponent.
    
    Args:
        base (float): Base number
        exponent (float): Exponent
        
    Returns:
        float: base raised to the power of exponent
    """
    return base ** exponent

def square_root(x: float) -> float:
    """
    Calculate the square root of x.
    
    Args:
        x (float): Input number
        
    Returns:
        float: Square root of x
        
    Raises:
        ValueError: If x is negative
    """
    if x < 0:
        raise ValueError("Cannot calculate square root of a negative number")
    return x ** 0.5
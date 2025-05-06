"""
Tests for the Gradio MCP tools.
"""

import unittest
import sys
import os
from pathlib import Path

# Add the parent directory to the Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tools.calculator import add, subtract, multiply, divide, power, square_root
from tools.text_processor import count_words, count_characters, to_uppercase, to_lowercase, reverse_text, extract_emails, summarize_text

class TestCalculatorTools(unittest.TestCase):
    """
    Test cases for calculator tools.
    """
    
    def test_add(self):
        """Test the add function."""
        self.assertEqual(add(1, 2), 3)
        self.assertEqual(add(-1, 1), 0)
        self.assertEqual(add(0, 0), 0)
    
    def test_subtract(self):
        """Test the subtract function."""
        self.assertEqual(subtract(5, 3), 2)
        self.assertEqual(subtract(3, 5), -2)
        self.assertEqual(subtract(0, 0), 0)
    
    def test_multiply(self):
        """Test the multiply function."""
        self.assertEqual(multiply(2, 3), 6)
        self.assertEqual(multiply(-2, 3), -6)
        self.assertEqual(multiply(0, 5), 0)
    
    def test_divide(self):
        """Test the divide function."""
        self.assertEqual(divide(6, 3), 2)
        self.assertEqual(divide(5, 2), 2.5)
        self.assertEqual(divide(0, 5), 0)
        with self.assertRaises(ZeroDivisionError):
            divide(5, 0)
    
    def test_power(self):
        """Test the power function."""
        self.assertEqual(power(2, 3), 8)
        self.assertEqual(power(2, 0), 1)
        self.assertEqual(power(0, 5), 0)
    
    def test_square_root(self):
        """Test the square_root function."""
        self.assertEqual(square_root(4), 2)
        self.assertEqual(square_root(9), 3)
        self.assertEqual(square_root(0), 0)
        with self.assertRaises(ValueError):
            square_root(-1)

class TestTextProcessorTools(unittest.TestCase):
    """
    Test cases for text processor tools.
    """
    
    def test_count_words(self):
        """Test the count_words function."""
        self.assertEqual(count_words("Hello, world!"), 2)
        self.assertEqual(count_words("This is a test."), 4)
        self.assertEqual(count_words(""), 0)
    
    def test_count_characters(self):
        """Test the count_characters function."""
        self.assertEqual(count_characters("Hello, world!"), 13)
        self.assertEqual(count_characters("Hello, world!", include_spaces=False), 12)
        self.assertEqual(count_characters(""), 0)
    
    def test_to_uppercase(self):
        """Test the to_uppercase function."""
        self.assertEqual(to_uppercase("Hello, world!"), "HELLO, WORLD!")
        self.assertEqual(to_uppercase("abc"), "ABC")
        self.assertEqual(to_uppercase(""), "")
    
    def test_to_lowercase(self):
        """Test the to_lowercase function."""
        self.assertEqual(to_lowercase("HELLO, WORLD!"), "hello, world!")
        self.assertEqual(to_lowercase("ABC"), "abc")
        self.assertEqual(to_lowercase(""), "")
    
    def test_reverse_text(self):
        """Test the reverse_text function."""
        self.assertEqual(reverse_text("Hello"), "olleH")
        self.assertEqual(reverse_text("12345"), "54321")
        self.assertEqual(reverse_text(""), "")
    
    def test_extract_emails(self):
        """Test the extract_emails function."""
        self.assertEqual(extract_emails("Contact us at info@example.com"), ["info@example.com"])
        self.assertEqual(extract_emails("Email: user@example.com and admin@example.com"), ["user@example.com", "admin@example.com"])
        self.assertEqual(extract_emails("No email here"), [])
    
    def test_summarize_text(self):
        """Test the summarize_text function."""
        self.assertEqual(summarize_text("This is a short text.", max_length=100), "This is a short text.")
        self.assertEqual(summarize_text("This is a longer text that needs to be summarized.", max_length=10), "This is a...")
        self.assertEqual(summarize_text("", max_length=10), "")

if __name__ == "__main__":
    unittest.main()
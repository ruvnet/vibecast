#!/usr/bin/env python3
"""
OpenRouter API Demo and Testing Script

This script demonstrates how to use the OpenRouter API for:
- Listing available models
- Making chat completion requests
- Streaming responses
- Handling different model providers
"""

import os
import sys
import json
import time
from typing import Optional, Dict, List, Any
import argparse

try:
    import requests
except ImportError:
    print("Error: 'requests' library not found. Install with: pip install requests")
    sys.exit(1)


class OpenRouterClient:
    """Client for interacting with the OpenRouter API"""

    BASE_URL = "https://openrouter.ai/api/v1"

    def __init__(self, api_key: Optional[str] = None, site_url: Optional[str] = None, app_name: Optional[str] = None):
        """
        Initialize the OpenRouter client

        Args:
            api_key: OpenRouter API key (or set OPENROUTER_API_KEY env var)
            site_url: Your site URL for rankings (or set OPENROUTER_SITE_URL env var)
            app_name: Your app name (or set OPENROUTER_APP_NAME env var)
        """
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")
        self.site_url = site_url or os.getenv("OPENROUTER_SITE_URL", "")
        self.app_name = app_name or os.getenv("OPENROUTER_APP_NAME", "OpenRouter Demo")

        if not self.api_key:
            print("⚠️  Warning: No API key provided. Some features will not work.")
            print("   Set OPENROUTER_API_KEY environment variable or pass api_key parameter.")

    def _get_headers(self) -> Dict[str, str]:
        """Get headers for API requests"""
        headers = {
            "Content-Type": "application/json",
        }

        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        if self.site_url:
            headers["HTTP-Referer"] = self.site_url

        if self.app_name:
            headers["X-Title"] = self.app_name

        return headers

    def list_models(self) -> List[Dict[str, Any]]:
        """Get list of all available models"""
        url = f"{self.BASE_URL}/models"
        response = requests.get(url, headers=self._get_headers())
        response.raise_for_status()
        return response.json().get("data", [])

    def get_model_by_id(self, model_id: str) -> Optional[Dict[str, Any]]:
        """Get specific model by ID"""
        models = self.list_models()
        for model in models:
            if model.get("id") == model_id:
                return model
        return None

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "openai/gpt-3.5-turbo",
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        stream: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Create a chat completion

        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model ID to use
            temperature: Sampling temperature (0-2)
            max_tokens: Maximum tokens to generate
            stream: Whether to stream the response
            **kwargs: Additional parameters to pass to the API
        """
        if not self.api_key:
            raise ValueError("API key required for chat completions")

        url = f"{self.BASE_URL}/chat/completions"

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": stream,
            **kwargs
        }

        if max_tokens:
            payload["max_tokens"] = max_tokens

        response = requests.post(
            url,
            headers=self._get_headers(),
            json=payload,
            stream=stream
        )
        response.raise_for_status()

        if stream:
            return response  # Return response object for streaming
        else:
            return response.json()

    def print_model_info(self, model: Dict[str, Any], detailed: bool = False):
        """Print formatted model information"""
        model_id = model.get("id", "Unknown")
        name = model.get("name", "N/A")
        context = model.get("context_length", 0)
        pricing = model.get("pricing", {})
        prompt_price = pricing.get("prompt", "0")
        completion_price = pricing.get("completion", "0")

        print(f"  • {model_id}")
        print(f"    Name: {name}")
        print(f"    Context: {context:,} tokens")
        print(f"    Pricing: ${prompt_price}/1M prompt, ${completion_price}/1M completion")

        if detailed:
            description = model.get("description", "")
            if description:
                print(f"    Description: {description}")

            top_provider = model.get("top_provider", {})
            if top_provider:
                print(f"    Provider: {top_provider.get('name', 'N/A')}")


def test_connectivity():
    """Test basic connectivity to OpenRouter"""
    print("🔍 Testing OpenRouter API connectivity...\n")

    try:
        client = OpenRouterClient()
        models = client.list_models()

        print(f"✅ Successfully connected to OpenRouter API")
        print(f"📊 Found {len(models)} available models\n")

        # Show some statistics
        free_models = [m for m in models if m.get('pricing', {}).get('prompt') == '0']
        providers = set()
        for m in models:
            model_id = m.get('id', '')
            if '/' in model_id:
                provider = model_id.split('/')[0]
                providers.add(provider)

        print(f"Statistics:")
        print(f"  • Total models: {len(models)}")
        print(f"  • Free models: {len(free_models)}")
        print(f"  • Unique providers: {len(providers)}")

        return True
    except Exception as e:
        print(f"❌ Error connecting to OpenRouter: {e}")
        return False


def list_models_cmd(args):
    """Command to list available models"""
    client = OpenRouterClient()

    try:
        models = client.list_models()

        # Filter by provider if specified
        if args.provider:
            models = [m for m in models if m.get('id', '').startswith(f"{args.provider}/")]

        # Filter free models if specified
        if args.free:
            models = [m for m in models if m.get('pricing', {}).get('prompt') == '0']

        # Sort by context length if specified
        if args.sort == 'context':
            models = sorted(models, key=lambda m: m.get('context_length', 0), reverse=True)

        print(f"\n📋 Available Models ({len(models)} total):\n")

        # Limit results if specified
        display_models = models[:args.limit] if args.limit else models

        for model in display_models:
            client.print_model_info(model, detailed=args.detailed)
            print()

        if args.limit and len(models) > args.limit:
            print(f"... and {len(models) - args.limit} more models")

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


def chat_cmd(args):
    """Command to test chat completion"""
    client = OpenRouterClient()

    if not client.api_key:
        print("❌ Error: API key required for chat completions")
        print("   Set OPENROUTER_API_KEY environment variable or use --api-key flag")
        sys.exit(1)

    messages = [
        {"role": "user", "content": args.message}
    ]

    print(f"\n💬 Sending message to {args.model}...")
    print(f"   Message: \"{args.message}\"\n")

    try:
        start_time = time.time()

        if args.stream:
            # Streaming response
            print("🤖 Response (streaming):")
            response = client.chat_completion(
                messages=messages,
                model=args.model,
                temperature=args.temperature,
                max_tokens=args.max_tokens,
                stream=True
            )

            full_response = ""
            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data: '):
                        data = line[6:]
                        if data == '[DONE]':
                            break
                        try:
                            chunk = json.loads(data)
                            content = chunk.get('choices', [{}])[0].get('delta', {}).get('content', '')
                            if content:
                                print(content, end='', flush=True)
                                full_response += content
                        except json.JSONDecodeError:
                            pass
            print("\n")

        else:
            # Non-streaming response
            response = client.chat_completion(
                messages=messages,
                model=args.model,
                temperature=args.temperature,
                max_tokens=args.max_tokens,
                stream=False
            )

            elapsed = time.time() - start_time

            # Print response
            content = response.get('choices', [{}])[0].get('message', {}).get('content', '')
            print("🤖 Response:")
            print(content)
            print()

            # Print statistics
            usage = response.get('usage', {})
            print(f"📊 Statistics:")
            print(f"   Time: {elapsed:.2f}s")
            print(f"   Prompt tokens: {usage.get('prompt_tokens', 0)}")
            print(f"   Completion tokens: {usage.get('completion_tokens', 0)}")
            print(f"   Total tokens: {usage.get('total_tokens', 0)}")

            # Calculate cost if available
            model_data = client.get_model_by_id(args.model)
            if model_data:
                pricing = model_data.get('pricing', {})
                prompt_price = float(pricing.get('prompt', 0))
                completion_price = float(pricing.get('completion', 0))

                prompt_cost = (usage.get('prompt_tokens', 0) / 1_000_000) * prompt_price
                completion_cost = (usage.get('completion_tokens', 0) / 1_000_000) * completion_price
                total_cost = prompt_cost + completion_cost

                if total_cost > 0:
                    print(f"   Estimated cost: ${total_cost:.6f}")

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="OpenRouter API Demo and Testing Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test connectivity
  python openrouter_demo.py test

  # List all models
  python openrouter_demo.py list

  # List models from specific provider
  python openrouter_demo.py list --provider anthropic

  # List free models only
  python openrouter_demo.py list --free

  # Chat with a model (requires API key)
  python openrouter_demo.py chat "What is the capital of France?"

  # Chat with specific model
  python openrouter_demo.py chat "Explain quantum computing" --model anthropic/claude-3.5-sonnet

  # Stream response
  python openrouter_demo.py chat "Tell me a story" --stream
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Command to execute')

    # Test command
    subparsers.add_parser('test', help='Test API connectivity')

    # List command
    list_parser = subparsers.add_parser('list', help='List available models')
    list_parser.add_argument('--provider', help='Filter by provider (e.g., anthropic, openai)')
    list_parser.add_argument('--free', action='store_true', help='Show only free models')
    list_parser.add_argument('--sort', choices=['context', 'name'], help='Sort models')
    list_parser.add_argument('--limit', type=int, help='Limit number of results')
    list_parser.add_argument('--detailed', action='store_true', help='Show detailed information')

    # Chat command
    chat_parser = subparsers.add_parser('chat', help='Test chat completion')
    chat_parser.add_argument('message', help='Message to send')
    chat_parser.add_argument('--model', default='openai/gpt-3.5-turbo', help='Model to use')
    chat_parser.add_argument('--temperature', type=float, default=0.7, help='Temperature (0-2)')
    chat_parser.add_argument('--max-tokens', type=int, help='Max tokens to generate')
    chat_parser.add_argument('--stream', action='store_true', help='Stream the response')
    chat_parser.add_argument('--api-key', help='OpenRouter API key (or set OPENROUTER_API_KEY)')

    args = parser.parse_args()

    # Set API key from args if provided
    if hasattr(args, 'api_key') and args.api_key:
        os.environ['OPENROUTER_API_KEY'] = args.api_key

    # Execute command
    if args.command == 'test':
        test_connectivity()
    elif args.command == 'list':
        list_models_cmd(args)
    elif args.command == 'chat':
        chat_cmd(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

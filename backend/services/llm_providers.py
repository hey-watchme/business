"""
LLM provider abstraction layer for Business API

Supports multiple providers: OpenAI, Google Gemini
Provider selection via environment variables or API parameters
"""

from abc import ABC, abstractmethod
from typing import Optional
import os
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# ==========================================
# Default LLM Provider Configuration
# ==========================================
CURRENT_PROVIDER = os.getenv("LLM_DEFAULT_PROVIDER", "openai")
CURRENT_MODEL = os.getenv("LLM_DEFAULT_MODEL", "gpt-4o")
# ==========================================


class LLMProvider(ABC):
    """Abstract base class for LLM providers"""

    @abstractmethod
    def generate(self, prompt: str) -> str:
        """
        Generate LLM response from prompt

        Args:
            prompt: Input prompt

        Returns:
            LLM response text
        """
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return model name with provider"""
        pass


class OpenAIProvider(LLMProvider):
    """OpenAI API provider"""

    def __init__(self, model: str = "gpt-4o"):
        """
        Args:
            model: OpenAI model name (e.g., "gpt-4o", "gpt-4o-mini", "gpt-5-nano")
        """
        from openai import OpenAI

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")

        self.client = OpenAI(api_key=api_key)
        self._model = model

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(Exception)
    )
    def generate(self, prompt: str) -> str:
        """Call OpenAI API with retry"""
        try:
            response = self.client.chat.completions.create(
                model=self._model,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content

        except Exception as e:
            print(f"OpenAI API call error: {e}")
            raise

    @property
    def model_name(self) -> str:
        return f"openai/{self._model}"


class GeminiProvider(LLMProvider):
    """Google Gemini API provider"""

    def __init__(self, model: str = "gemini-3-pro-preview"):
        """
        Args:
            model: Gemini model name (e.g., "gemini-3-pro-preview", "gemini-2.0-flash-exp")
        """
        from google import genai

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")

        self.client = genai.Client(api_key=api_key)
        self._model = model

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(Exception)
    )
    def generate(self, prompt: str) -> str:
        """Call Gemini API with retry"""
        try:
            response = self.client.models.generate_content(
                model=self._model,
                contents=prompt
            )
            return response.text

        except Exception as e:
            print(f"Gemini API call error: {e}")
            raise

    @property
    def model_name(self) -> str:
        return f"gemini/{self._model}"


class LLMFactory:
    """LLM provider factory"""

    @staticmethod
    def create(provider: str, model: Optional[str] = None) -> LLMProvider:
        """
        Create LLM provider instance

        Args:
            provider: Provider name ("openai", "gemini")
            model: Model name (optional, uses default for each provider)

        Returns:
            LLMProvider instance
        """
        provider = provider.lower()

        if provider == "openai":
            return OpenAIProvider(model or "gpt-4o")
        elif provider == "gemini":
            return GeminiProvider(model or "gemini-3-pro-preview")
        else:
            raise ValueError(f"Unknown provider: {provider}. Supported: openai, gemini")

    @staticmethod
    def get_current() -> LLMProvider:
        """Get current LLM provider based on configuration"""
        print(f"Using LLM provider: {CURRENT_PROVIDER}/{CURRENT_MODEL}")
        return LLMFactory.create(CURRENT_PROVIDER, CURRENT_MODEL)


def get_current_llm() -> LLMProvider:
    """Get current LLM provider (alias)"""
    return LLMFactory.get_current()

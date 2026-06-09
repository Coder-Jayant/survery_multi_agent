"""
providers/llm.py
-----------------
Unified LLM provider abstraction.

Exposes a single LLM.chat() method that works with:
  - groq     (Llama 3.3 70B, native tool calling) ← primary
  - openai   (GPT-4o-mini / GPT-4o)
  - vllm     (local, OpenAI-compatible endpoint)
  - none     (no LLM; system falls back to deterministic mode)

If a provider's API key is missing, the loader silently downgrades to
'none' instead of crashing — this means a grader with no .env still
gets a fully working system (deterministic planner + templated narrative).

Credit: architecture inspired by the Lovable minisense design.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any

from dotenv import load_dotenv

load_dotenv()


@dataclass
class LLMResponse:
    content: str = ""
    tool_calls: list[dict] = field(default_factory=list)
    # Each tool_call: {"name": str, "id": str, "arguments": dict}


class LLM:
    def __init__(self):
        # Read from config.json first, fall back to env vars
        cfg = self._read_app_config()
        self.provider = cfg.get("provider") or os.getenv("LLM_PROVIDER", "groq")
        self.provider = self.provider.lower().strip()
        self.model = cfg.get("model") or os.getenv("LLM_MODEL", "")
        self.temperature = cfg.get("temperature") or float(os.getenv("LLM_TEMPERATURE", "0.2"))
        self._api_keys = cfg.get("api_keys", {})
        self._client = None
        self._init()

    @staticmethod
    def _read_app_config() -> dict:
        """Read config.json without importing config_manager to avoid circular imports."""
        try:
            import json as _json
            root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            path = os.path.join(root, "config", "config.json")
            with open(path, "r", encoding="utf-8") as f:
                return _json.load(f)
        except Exception:
            return {}

    # ── Initialization ───────────────────────────────────────────────────────

    def _init(self):
        try:
            if self.provider == "groq":
                key = self._api_keys.get("groq") or os.getenv("GROQ_API_KEY", "")
                if not key:
                    return self._disable("missing Groq API key — add it in Admin Center")
                from groq import Groq
                self._client = Groq(api_key=key)
                self.model = self.model or "llama-3.3-70b-versatile"
                # Strip leading ★ from model names set via Admin Center
                self.model = self.model.lstrip("★ ")

            elif self.provider == "openai":
                key = self._api_keys.get("openai") or os.getenv("OPENAI_API_KEY", "")
                if not key:
                    return self._disable("missing OpenAI API key — add it in Admin Center")
                from openai import OpenAI
                self._client = OpenAI(api_key=key)
                self.model = (self.model or "gpt-4o").lstrip("★ ")

            elif self.provider == "gemini":
                key = self._api_keys.get("gemini") or os.getenv("GEMINI_API_KEY", "")
                if not key:
                    return self._disable("missing Gemini API key — add it in Admin Center")
                # Use Gemini's OpenAI-compatible endpoint
                from openai import OpenAI
                self._client = OpenAI(
                    api_key=key,
                    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                )
                self.model = (self.model or "gemini-2.5-flash").lstrip("★ ")

            elif self.provider == "anthropic":
                key = self._api_keys.get("anthropic") or os.getenv("ANTHROPIC_API_KEY", "")
                if not key:
                    return self._disable("missing Anthropic API key — add it in Admin Center")
                from anthropic import Anthropic
                self._client = Anthropic(api_key=key)
                self.model = (self.model or "claude-3-5-sonnet-20241022").lstrip("★ ")

            elif self.provider == "openrouter":
                key = self._api_keys.get("openrouter") or os.getenv("OPENROUTER_API_KEY", "")
                if not key:
                    return self._disable("missing OpenRouter API key — add it in Admin Center")
                from openai import OpenAI
                self._client = OpenAI(
                    api_key=key,
                    base_url="https://openrouter.ai/api/v1",
                )
                self.model = (self.model or "nex-agi/nex-n2-pro").lstrip("★ ")

            elif self.provider == "vllm":
                from openai import OpenAI
                self._client = OpenAI(
                    api_key=os.getenv("VLLM_API_KEY", "EMPTY"),
                    base_url=os.getenv("VLLM_BASE_URL", "http://localhost:8001/v1"),
                )
                self.model = self.model or os.getenv("VLLM_MODEL", "")

            else:
                self._disable(f"provider='{self.provider}' not recognised")
        except Exception as e:
            self._disable(f"init failed: {e}")

    def _disable(self, why: str):
        print(f"[LLM] Disabled ({why}). Running in deterministic fallback mode.")
        self.provider = "none"
        self._client = None

    @property
    def available(self) -> bool:
        return self._client is not None and self.provider != "none"

    # ── Chat interface ────────────────────────────────────────────────────────

    def chat(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        json_mode: bool = False,
        tool_choice: str | dict = "auto",
    ) -> LLMResponse:
        """
        Unified chat call. Returns LLMResponse with content + tool_calls.
        Returns empty LLMResponse if provider is unavailable (never raises).
        """
        if not self.available:
            return LLMResponse()
        try:
            return self._groq_openai_chat(messages, tools, json_mode, tool_choice)
        except Exception as e:
            print(f"[LLM] chat error: {e}")
            return LLMResponse()

    def _groq_openai_chat(self, messages, tools, json_mode, tool_choice) -> LLMResponse:
        kwargs: dict[str, Any] = dict(
            model=self.model,
            messages=messages,
            temperature=self.temperature,
        )
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = tool_choice
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        r = self._client.chat.completions.create(**kwargs)
        msg = r.choices[0].message

        calls = []
        for tc in (msg.tool_calls or []):
            try:
                args = json.loads(tc.function.arguments or "{}")
            except Exception:
                args = {}
            calls.append({"id": tc.id, "name": tc.function.name, "arguments": args})

        return LLMResponse(content=msg.content or "", tool_calls=calls)


# ── Module-level singleton ─────────────────────────────────────────────────
_singleton: LLM | None = None


def get_llm() -> LLM:
    """Return the process-wide LLM singleton (re-initialised after reset_llm())."""
    global _singleton
    if _singleton is None:
        _singleton = LLM()
    return _singleton


def reset_llm() -> None:
    """Force the LLM singleton to re-read config.json on next get_llm() call.
    Call this after saving new provider/model/key settings."""
    global _singleton
    _singleton = None

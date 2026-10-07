"""Provider interfaces (report section 16). Route code depends only on these."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


class ProviderError(Exception):
    """A provider call failed. `transient` errors are retried once (report section 30)."""

    def __init__(self, message: str, transient: bool = False):
        super().__init__(message)
        self.transient = transient


@dataclass
class ProviderResult:
    data: object
    provider: str
    model: str = ""
    usage: dict = field(default_factory=dict)
    cost: float = 0.0


class StoryProvider(ABC):
    name = "story"

    @abstractmethod
    async def plan_film(self, brief: dict) -> ProviderResult:
        """Return a FilmProject dict (camelCase) for the brief."""

    @abstractmethod
    async def edit(self, memory: dict, target: str, instruction: str) -> ProviderResult:
        """Return the new value for memory[target] after applying the instruction."""


class ImageProvider(ABC):
    @abstractmethod
    async def generate_image(self, prompt: str, *, size: str = "1536x1024", references: list[bytes] | None = None) -> ProviderResult:
        """Return image bytes (PNG/SVG) in `data`."""


class VideoProvider(ABC):
    @abstractmethod
    async def generate_video(self, prompt: str, *, image_url: str, duration: int, quality: str, aspect_ratio: str) -> ProviderResult:
        """Return a video URL (str) in `data`, or None if the provider produces no video."""


class TTSProvider(ABC):
    @abstractmethod
    async def generate_voice(self, text: str, *, language: str = "en-IN", speaker: str | None = None) -> ProviderResult:
        """Return audio bytes (WAV) in `data`."""

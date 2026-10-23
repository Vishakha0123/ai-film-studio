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
    async def edit(self, memory: dict, target: str, instruction: str, *, language: str = "en") -> ProviderResult:
        """Return the new value for memory[target] after applying the instruction."""

    @abstractmethod
    async def translate_film(self, memory: dict, language: str) -> ProviderResult:
        """Return the same FilmProject dict with every text value in `language` (a code like "ta")."""

    # Long film (10 minutes – 2 hours): planned in steps because no model writes a feature film in one reply
    async def outline_scenes(self, bible: dict, *, first: int, last: int, total: int, target_seconds: int,
                             story_so_far: list[dict], language: str) -> ProviderResult:
        """Return {"scenes": [...]} for scenes first..last of the film."""
        raise ProviderError(f"{self.__class__.__name__} can't plan long films")

    async def break_down_scene(self, bible: dict, scene: dict, *, total: int, shot_count: int, shot_seconds: int,
                               previous: str, next_scene: str, language: str,
                               direction: str = "") -> ProviderResult:
        """Return {"script", "continuity", "shots": [...]} for one scene."""
        raise ProviderError(f"{self.__class__.__name__} can't plan long films")


class ImageProvider(ABC):
    @abstractmethod
    async def generate_image(self, prompt: str, *, size: str = "1536x1024", references: list[bytes] | None = None,
                             negative_prompt: str = "") -> ProviderResult:
        """Return image bytes (PNG/SVG) in `data`. `negative_prompt` lists what the image must not look like."""


class VideoProvider(ABC):
    @abstractmethod
    async def generate_video(self, prompt: str, *, image_url: str, duration: int, quality: str, aspect_ratio: str) -> ProviderResult:
        """Return a video URL (str) in `data`, or None if the provider produces no video."""


class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio: bytes, *, filename: str, language: str = "en-IN") -> ProviderResult:
        """Return the transcript (str) in `data`."""


class TTSProvider(ABC):
    @abstractmethod
    async def generate_voice(self, text: str, *, language: str = "en-IN", speaker: str | None = None,
                             pace: float = 1.0) -> ProviderResult:
        """Return audio bytes (WAV) in `data`."""

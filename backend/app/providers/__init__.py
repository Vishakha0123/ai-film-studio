"""Model router: picks the configured provider for each task (report section 17)."""

from app.config import get_settings
from app.providers.base import ImageProvider, ProviderError, StoryProvider, STTProvider, TTSProvider, VideoProvider


def story_provider() -> StoryProvider:
    if get_settings().STORY_PROVIDER == "sarvam":
        from app.providers.sarvam import SarvamStory
        return SarvamStory()
    from app.providers.mock import MockStory
    return MockStory()


def image_provider() -> ImageProvider:
    if get_settings().IMAGE_PROVIDER == "openai":
        from app.providers.openai_images import OpenAIImage
        return OpenAIImage()
    from app.providers.mock import MockImage
    return MockImage()


def video_provider() -> VideoProvider:
    if get_settings().VIDEO_PROVIDER == "seedance":
        from app.providers.seedance import SeedanceVideo
        return SeedanceVideo()
    from app.providers.mock import MockVideo
    return MockVideo()


def tts_provider() -> TTSProvider:
    if get_settings().TTS_PROVIDER == "sarvam":
        from app.providers.sarvam import SarvamTTS
        return SarvamTTS()
    from app.providers.mock import MockTTS
    return MockTTS()


def stt_provider() -> STTProvider:
    if get_settings().STT_PROVIDER == "sarvam":
        from app.providers.sarvam import SarvamSTT
        return SarvamSTT()
    from app.providers.mock import MockSTT
    return MockSTT()


__all__ = ["ProviderError", "story_provider", "image_provider", "video_provider", "tts_provider", "stt_provider"]

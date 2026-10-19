"""Voices the studio offers (Sarvam Bulbul v3 speakers) and the short line used to preview them."""

VOICES: tuple[str, ...] = (
    "shubh", "aditya", "ritu", "priya", "neha", "rahul", "pooja", "rohan", "simran", "kavya", "amit", "dev",
    "ishita", "shreya", "ratan", "varun", "manan", "sumit", "roopa", "kabir", "aayan", "ashutosh", "advait",
    "anand", "tanya", "tarun", "sunny", "mani", "gokul", "vijay", "shruti", "suhani", "mohit", "kavitha",
    "rehan", "soham", "rupali",
)

PREVIEW_LINES: dict[str, str] = {
    "en": "Every story begins with a single frame. Welcome to your film.",
    "hi": "हर कहानी एक दृश्य से शुरू होती है। आपकी फ़िल्म में आपका स्वागत है।",
    "ta": "ஒவ்வொரு கதையும் ஒரு காட்சியில் தொடங்குகிறது. உங்கள் படத்திற்கு வரவேற்கிறோம்.",
    "te": "ప్రతి కథ ఒక దృశ్యంతో మొదలవుతుంది. మీ సినిమాకు స్వాగతం.",
    "kn": "ಪ್ರತಿಯೊಂದು ಕಥೆಯೂ ಒಂದು ದೃಶ್ಯದಿಂದ ಆರಂಭವಾಗುತ್ತದೆ. ನಿಮ್ಮ ಸಿನಿಮಾಗೆ ಸ್ವಾಗತ.",
    "ml": "ഓരോ കഥയും ഒരു ദൃശ്യത്തിൽ നിന്നാണ് തുടങ്ങുന്നത്. നിങ്ങളുടെ സിനിമയിലേക്ക് സ്വാഗതം.",
    "bn": "প্রতিটি গল্প একটি দৃশ্য দিয়ে শুরু হয়। আপনার ছবিতে স্বাগতম।",
    "mr": "प्रत्येक कथा एका दृश्याने सुरू होते. तुमच्या चित्रपटात स्वागत आहे.",
    "gu": "દરેક વાર્તા એક દ્રશ્યથી શરૂ થાય છે. તમારી ફિલ્મમાં સ્વાગત છે.",
    "pa": "ਹਰ ਕਹਾਣੀ ਇੱਕ ਦ੍ਰਿਸ਼ ਨਾਲ ਸ਼ੁਰੂ ਹੁੰਦੀ ਹੈ। ਤੁਹਾਡੀ ਫ਼ਿਲਮ ਵਿੱਚ ਜੀ ਆਇਆਂ ਨੂੰ।",
}


def preview_line(language: str) -> str:
    return PREVIEW_LINES.get(language, PREVIEW_LINES["en"])

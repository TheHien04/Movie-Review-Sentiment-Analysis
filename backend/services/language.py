"""
Language detection for multilingual review routing.
"""
from __future__ import annotations

import re
from typing import Optional, Tuple

_SUPPORTED = frozenset({"en", "fr", "es", "de", "it", "pt", "nl", "pl", "ru", "ja", "zh", "ko", "ar"})


def detect_language(text: str) -> Tuple[str, float]:
    """
    Returns (iso_code, confidence). Falls back to 'en' on failure.
    """
    if not text or not str(text).strip():
        return "en", 0.0

    sample = str(text).strip()[:2000]
    try:
        from langdetect import DetectorFactory, detect_langs

        DetectorFactory.seed = 0
        langs = detect_langs(sample)
        if langs:
            top = langs[0]
            code = str(top.lang).split("-")[0].lower()
            if code in _SUPPORTED or len(code) == 2:
                return code, float(top.prob)
    except Exception:
        pass

    # Heuristic: non-ASCII ratio suggests non-English
    non_ascii = sum(1 for c in sample if ord(c) > 127)
    if non_ascii > len(sample) * 0.15:
        if re.search(r"[\u4e00-\u9fff]", sample):
            return "zh", 0.5
        if re.search(r"[\u3040-\u30ff\uac00-\ud7af]", sample):
            return "ja", 0.5
        return "multilingual", 0.4
    return "en", 0.9


def needs_multilingual_model(lang: str) -> bool:
    return lang not in ("en", "unknown") and lang != ""

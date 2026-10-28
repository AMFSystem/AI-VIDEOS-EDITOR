"""Khmer text normalization for TTS.

TTS models only know how to pronounce letters, so digits, currency symbols,
percentages and dates must be expanded into spoken Khmer words first:

    "$25"        -> "ម្ភៃប្រាំដុល្លារ"
    "13/10/2026" -> "ថ្ងៃទីដប់បី ខែតុលា ឆ្នាំពីរពាន់ម្ភៃប្រាំមួយ"
"""

import re
import unicodedata

DIGITS = ["សូន្យ", "មួយ", "ពីរ", "បី", "បួន", "ប្រាំ", "ប្រាំមួយ", "ប្រាំពីរ", "ប្រាំបី", "ប្រាំបួន"]
TENS = ["", "ដប់", "ម្ភៃ", "សាមសិប", "សែសិប", "ហាសិប", "ហុកសិប", "ចិតសិប", "ប៉ែតសិប", "កៅសិប"]
# Place values below one million. Each quotient here is always a single digit.
PLACES = [(100_000, "សែន"), (10_000, "ម៉ឺន"), (1_000, "ពាន់"), (100, "រយ")]
MILLION = "លាន"

MONTHS = [
    "មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា",
    "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ",
]

DECIMAL_POINT = "ចុច"
DOLLAR = "ដុល្លារ"
CENT = "សេន"
RIEL = "រៀល"
PERCENT = "ភាគរយ"

# Spoken Khmer pronunciation expansions for common technical, social media, and digital terms
KHMER_PHONETIC_EXPANSIONS = [
    (r"\bAI\b", "អាយ"),
    (r"\bApp\b", "អេប"),
    (r"\bApps\b", "អេប"),
    (r"\bFacebook\b", "ហ្វេសប៊ុក"),
    (r"\bFB\b", "ហ្វេសប៊ុក"),
    (r"\bYouTube\b", "យូធូប"),
    (r"\bTikTok\b", "ទីកតុក"),
    (r"\bVideo\b", "វីដេអូ"),
    (r"\bVideos\b", "វីដេអូ"),
    (r"\bGoogle\b", "ហ្គូហ្គល"),
    (r"\bLink\b", "លីង"),
    (r"\bWebsite\b", "វេបសាយ"),
    (r"\bWeb\b", "វេប"),
    (r"\bID\b", "អាយឌី"),
    (r"\bOnline\b", "អនឡាញ"),
    (r"\bLive\b", "ឡាយ"),
    (r"\bAudio\b", "អូឌីយ៉ូ"),
    (r"\bMusic\b", "ម្ញូស៊ីក"),
    (r"\bBot\b", "បុត"),
    (r"\bChat\b", "ឆាត"),
    (r"\bEditor\b", "អេឌីតទ័រ"),
    (r"\bEdit\b", "អេឌីត"),
    (r"\bAMF\b", "អេ អិម អេហ្វ"),
    (r"\bExpress\b", "អិចស្ព្រេស"),
    (r"\bCOD\b", "ស៊ីអូឌី"),
    (r"\bVIP\b", "វីអាយភី"),
    (r"\bDelivery\b", "ឌីលីវើរី"),
    (r"\bFast\b", "ហ្វាស"),
    (r"\bSystem\b", "ស៊ីស្ទឹម"),
    (r"\bTracking\b", "ត្រេកឃីង"),
    (r"\bCall\b", "ខល"),
    (r"\bCenter\b", "សិនធ័រ"),
]

# Phonetic substitutions for difficult Pali/Sanskrit Khmer words commonly mispronounced by TTS engines
KHMER_DIFFICULT_WORDS_PHONETIC_MAP = [
    # Business, Express, and Customer Service Key Vocabularies
    ("អតិថិជន", "អាក់តិថិជន"),
    ("ក្រុមហ៊ុន", "ក្រុមហ៊ុ៊ន"),
    ("សេវាកម្ម", "សេវ៉ាកម្ម"),
    ("ទំនុកចិត្ត", "ទំនុ៊កចិត្ត"),
    ("រហ័សទាន់ចិត្ត", "រ៉ាហ័ស ទាន់ចិត្ត"),
    ("ទាន់ចិត្ត", "ទាន់ចិត្ត"),
    ("សុវត្ថិភាព", "សុវ័តថិភាព"),
    ("ប្រសិទ្ធភាព", "ប្រាក់សិតថិភាព"),
    ("ដឹកជញ្ជូន", "ដឹកជ័ញ្ជូន"),
    ("បញ្ញើ", "ប៉ាញ់ញើ"),
    ("ទូទាំងប្រទេស", "ទូទាំង ប្រាក់ទេស"),
    ("ប្រទេសកម្ពុជា", "ប្រាក់ទេស កម្ពុជា"),
    ("រាជធានីភ្នំពេញ", "រាជជាក់ធានី ភ្នំពេញ"),
    ("ទូទាំង២៥ខេត្ត", "ទូទាំង ម្ភៃប្រាំ ខេត្ត"),
    ("ខេត្តក្រុង", "ខេត្ត ក្រុង"),
    ("ទូរស័ព្ទ", "ទូរ៉ាស័ព្ទ"),
    ("បុគ្គលិក", "បុ៊កគាក់លិក"),
    ("យកចិត្តទុកដាក់", "យកចិត្ត ទុកដាក់"),
    ("រួសរាយរាក់ទាក់", "រួសរាយ រាក់ទាក់"),
    ("ជម្រើសដ៏ល្អ", "ជំរើស ដ៏ល្អ"),
    ("ជម្រើស", "ជំរើស"),
    ("ទំនើប", "ទំនើប"),
    ("បច្ចេកវិទ្យា", "បាច់ចេកវិទ្យា"),
    ("ធម្មជាតិ", "ធ័រមាក់ជាតិ"),
    ("អន្តរជាតិ", "អន់តាក់រ៉ាជាតិ"),
    ("អភិវឌ្ឍន៍", "អាក់ភិវ័ឌ្ឍ"),
    ("អភិវឌ្ឍ", "អាក់ភិវ័ឌ្ឍ"),
    ("សេដ្ឋកិច្ច", "សេតថាក់កិច្ច"),
    ("សាកលវិទ្យាល័យ", "សាកល់វិទ្យាល័យ"),
    ("សុខមាលភាព", "សុខខាក់មាលភាព"),
    ("សុភមង្គល", "សុភាក់មង្គល"),
    ("រាជធានី", "រាជជាក់ធានី"),
    ("រាជរដ្ឋាភិបាល", "រាជរត់ថាក់ភិបាល"),
    ("ប្រជាពលរដ្ឋ", "ប្រាក់ជាពល់រ័ត"),
    ("ប្រជាជន", "ប្រាក់ជាជន"),
    ("ប្រជាធិបតេយ្យ", "ប្រាក់ជាធិបាក់តេយ្យ"),
    ("ព្រះរាជាណាចក្រ", "ព្រះរាជជាណាច័ក្រ"),
    ("ព្រះករុណា", "ព្រះកាក់រុណា"),
    ("ព្រះមហាក្សត្រ", "ព្រះមាក់ហាក្ស័ត្រ"),
    ("ក្រសួង", "ក្រាក់សួង"),
    ("មហាវិទ្យាល័យ", "មាក់ហាវីទ្យាល័យ"),
    ("ទស្សនៈ", "ទ័សសាក់នាក់"),
    ("វត្តមាន", "វ័តតាក់មាន"),
    ("អធិការបតី", "អាក់ធិការបាក់តី"),
    ("សន្តិសុខ", "សន់តិសុខ"),
    ("ឧស្សាហកម្ម", "អ៊ុសសាហាក់កម្ម"),
    ("ពាណិជ្ជកម្ម", "ពាណិជ្ជជាក់កម្ម"),
    ("ទេសចរណ៍", "ទេសាក់ចរ"),
    ("គមនាគមន៍", "គមាក់នាគមន៍"),
    ("វប្បធម៌", "វ៉ាប់ប៉ាក់ធ័រ"),
    ("យុត្តិធម៌", "យុតតិធ័រ"),
    ("ទស្សនាវដ្តី", "ទ័សសាក់នាវ័តដី"),
    ("ទូរទស្សន៍", "ទូរទ័ស"),
    ("សមាគម", "សាក់មាគម"),
    ("មហាសន្និបាត", "មាក់ហាសន់និបាត"),
    ("សហព័ន្ធ", "សាក់ហាក់ព័ន"),
    ("រដ្ឋធម្មនុញ្ញ", "រត់ថាក់ធ័រមាក់នុញ"),
    ("អព្យាក្រឹត", "អាក់ព្យាក្រឹត"),
    ("កាតព្វកិច្ច", "កាតព្វាក់កិច្ច"),
    ("សារមន្ទីរ", "សារាក់មន្ទីរ"),
    ("មហោស្រព", "មាក់ហោស្រព"),
    ("ជីវិត", "ជីវ៉ិត"),
    ("ទំនាក់ទំនង", "ទាក់ទង"),
    ("វិស័យ", "វិស័៍យ"),
    ("ឧបសគ្គ", "អ៊ុបាក់ស័ក"),
    ("សមិទ្ធផល", "សាក់មិតថាក់ផល"),
    ("មោទនភាព", "មោទាក់នាក់ភាព"),
    ("ស្ថាបត្យកម្ម", "ស្ថាបាត់ត្យាក់កម្ម"),
    ("គម្រោង", "គំរោង"),
    ("បរិស្ថាន", "បាក់រិស្ថាន"),
    ("និរន្តរភាព", "និរន់តាក់រ៉ាភាព"),
]

_KHMER_DIGITS = str.maketrans("០១២៣៤៥៦៧៨៩", "0123456789")

# "1,250,000.75" (grouped) or "1250000.75" (plain)
_NUM = r"\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?"
# An optional leading "ថ្ងៃទី" (day) is absorbed so "ថ្ងៃទី 13/10/2026" isn't read as "day day thirteen".
_DATE_RE = re.compile(r"(?:ថ្ងៃទី\s*)?\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b")
_TIME_RE = re.compile(r"(?:ម៉ោង\s*)?\b(\d{1,2}):(\d{2})\b")
_DOLLAR_RE = re.compile(rf"\$\s?({_NUM})|({_NUM})\s?\$")
_RIEL_RE = re.compile(rf"៛\s?({_NUM})|({_NUM})\s?៛")
_PERCENT_RE = re.compile(rf"({_NUM})\s?%")
_MEASURE_RE = re.compile(
    r"\b(\d+)\s*(នាក់|ឆ្នាំ|ខែ|ថ្ងៃ|ម៉ោង|នាទី|វិនាទី|ក្បាល|គ្រឿង|ដើម|ស្លឹក|ច្បាប់|កំប៉ុង|ដប|កញ្ចប់|ដង|ដុល្លារ|រៀល)\b"
)
_NUM_RE = re.compile(_NUM)


def verbalize_int(n: int) -> str:
    if n < 0:
        return "ដក" + verbalize_int(-n)
    if n < 10:
        return DIGITS[n]
    if n < 100:
        tens, ones = divmod(n, 10)
        return TENS[tens] + (DIGITS[ones] if ones else "")
    if n >= 1_000_000:
        # Recursion handles billions naturally: 10^9 -> "មួយពាន់លាន"
        millions, rest = divmod(n, 1_000_000)
        return verbalize_int(millions) + MILLION + (verbalize_int(rest) if rest else "")
    for value, name in PLACES:
        if n >= value:
            q, rest = divmod(n, value)
            return DIGITS[q] + name + (verbalize_int(rest) if rest else "")
    raise AssertionError("unreachable")


def verbalize_number(token: str) -> str:
    """Verbalize a numeric string such as '1,250' or '3.75'."""
    token = token.replace(",", "")
    whole, _, frac = token.partition(".")
    words = verbalize_int(int(whole))
    if frac:
        # Digits after the point are read one by one: 3.75 -> បីចុចប្រាំពីរប្រាំ
        words += DECIMAL_POINT + "".join(DIGITS[int(d)] for d in frac)
    return words


def _verbalize_dollars(amount: str) -> str:
    amount = amount.replace(",", "")
    whole, _, frac = amount.partition(".")
    words = verbalize_int(int(whole)) + DOLLAR
    if frac and len(frac) <= 2:
        cents = int(frac.ljust(2, "0"))
        if cents:
            words += " " + verbalize_int(cents) + CENT
    elif frac:
        words = verbalize_number(amount) + DOLLAR
    return words


def _verbalize_date(m: re.Match) -> str:
    day, month, year = int(m[1]), int(m[2]), int(m[3])
    if not (1 <= day <= 31 and 1 <= month <= 12):
        return m[0]
    return f"ថ្ងៃទី{verbalize_int(day)} ខែ{MONTHS[month - 1]} ឆ្នាំ{verbalize_int(year)}"


def _verbalize_time(m: re.Match) -> str:
    hour = int(m[1])
    minute = int(m[2])
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        return m[0]
    h_str = verbalize_int(hour)
    if minute == 0:
        return f"ម៉ោង{h_str}គត់"
    elif minute == 30:
        return f"ម៉ោង{h_str}កន្លះ"
    else:
        return f"ម៉ោង{h_str} {verbalize_int(minute)}នាទី"


def _expand_lek_to(text: str) -> str:
    """Expand Khmer repetition sign 'ៗ' (U+17D7) into spoken repeated words.

    Examples:
        'គោះៗ' -> 'គោះ គោះ'
        'កាន់តែខ្លាំងៗ' -> 'កាន់តែខ្លាំង ខ្លាំង'
    """
    def repl(m: re.Match) -> str:
        full = m.group(1)
        if " " in full:
            prefix, _, word = full.rpartition(" ")
            return f"{prefix} {word} {word}"
        word = full[-6:] if len(full) > 6 else full
        prefix = full[:-len(word)]
        return f"{prefix}{word} {word}"

    pattern = re.compile(r"([ក-៿]+)\s*ៗ")
    return pattern.sub(repl, text)


def normalize_khmer(text: str) -> str:
    if not text:
        return ""
    # Unicode canonical normalization for correct consonant cluster/subscript ordering
    text = unicodedata.normalize("NFC", text)

    # Phonetic loanword expansion so Local AI pronounces digital/tech words naturally
    for pattern, replacement in KHMER_PHONETIC_EXPANSIONS:
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

    # Phonetic pronunciation for difficult Pali/Sanskrit words
    for orig, phon in KHMER_DIFFICULT_WORDS_PHONETIC_MAP:
        text = text.replace(orig, phon)

    # Convert bracketed timing/pause tags like [pause 0.2s] into natural Khmer sentence pauses
    text = re.sub(r"\[pause\s*[\d.]+s?\]", "។ ", text, flags=re.IGNORECASE)

    # Common Khmer punctuation symbols
    text = text.replace("៘", "និងផ្សេងៗទៀត")
    text = text.replace("៕", "។")
    text = re.sub(r"\.{2,}|…", "។ ", text)

    # Expand repetition sign (Lek To ៗ)
    text = _expand_lek_to(text)

    # Digits from Khmer numeral script to ASCII
    text = text.translate(_KHMER_DIGITS)

    # Order matters: dates, time, currency, measure words, bare numbers
    text = _DATE_RE.sub(_verbalize_date, text)
    text = _TIME_RE.sub(_verbalize_time, text)
    text = _DOLLAR_RE.sub(lambda m: _verbalize_dollars(m[1] or m[2]), text)
    text = _RIEL_RE.sub(lambda m: verbalize_number(m[1] or m[2]) + RIEL, text)
    text = _PERCENT_RE.sub(lambda m: verbalize_number(m[1]) + PERCENT, text)
    text = _MEASURE_RE.sub(lambda m: verbalize_int(int(m[1])) + m[2], text)
    text = _NUM_RE.sub(lambda m: verbalize_number(m[0]), text)

    # Clean multiple spaces while maintaining natural sentence flow
    text = re.sub(r"[ \t]+", " ", text).strip()
    return text


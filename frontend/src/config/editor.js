import {
  ClosedCaptioning,
  Faders,
  FilmSlate,
  ImageSquare,
  Intersect,
  MagnifyingGlassPlus,
  MusicNote,
  MagicWand,
  PlugsConnected,
  Scan,
  SlidersHorizontal,
  Sticker,
  TextT,
  Waveform,
} from "@phosphor-icons/react";

export { MODEL_ID, AUTOMATIC_CAPTION_MODEL_ID, AUTOMATIC_CAPTION_MODEL_LABEL } from "./models.js";

export const SAMPLE_IMAGE = "/assets/sample-portrait.png";
export const DEFAULT_TIMELINE_DURATION_SECONDS = 10;
export const MAX_TIMELINE_DURATION_SECONDS = 24 * 60 * 60;
export const IMAGE_SEGMENT_SECONDS = 2;
// Keep short cuts valid through trimming, speed changes and project recovery.
export const MIN_VISUAL_SEGMENT_SECONDS = 0.05;
export const MAX_IMAGE_THUMBNAILS = 80;
export const IMAGE_RESIZE_OVERFLOW_SECONDS_PER_PIXEL = 0.05;
export const IMAGE_SNAP_THRESHOLD_PIXELS = 16;
export const MIN_CAPTION_SEGMENT_SECONDS = 1.2;
export const MAX_CAPTION_SEGMENT_SECONDS = 12;
export const SUPPORTED_MEDIA_TYPES = ["image/", "video/", "audio/"];
export const ASSET_DRAG_MIME = "application/x-ai-voiceover-asset";
export const COMPACT_WORKSPACE_QUERY = "(max-width: 1279px)";

export const DEFAULT_SCRIPT = "";

const LEGACY_VOICE_ID_ALIASES = {
  zh_m_yansheng: "zh_f_ruoxi",
  zh_m_yunzhou: "zh_f_qinglan",
  zh_m_jingche: "zh_f_ruoxi",
};

export function normalizeVoiceId(voiceId) {
  return LEGACY_VOICE_ID_ALIASES[voiceId] || voiceId;
}

export const EXPORT_RECORDING_FORMATS = [
  {
    mimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    extension: "mp4",
    label: "MP4",
  },
  {
    mimeType: "video/mp4;codecs=h264,aac",
    extension: "mp4",
    label: "MP4",
  },
  {
    mimeType: "video/mp4",
    extension: "mp4",
    label: "MP4",
  },
  {
    mimeType: "video/webm;codecs=vp9,opus",
    extension: "webm",
    label: "WebM",
  },
  {
    mimeType: "video/webm;codecs=vp8,opus",
    extension: "webm",
    label: "WebM",
  },
  {
    mimeType: "video/webm",
    extension: "webm",
    label: "WebM",
  },
];

export const AUDIO_RECORDING_FORMATS = [
  { mimeType: "audio/webm;codecs=opus", extension: "webm" },
  { mimeType: "audio/webm", extension: "webm" },
  { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
  { mimeType: "audio/mp4", extension: "m4a" },
];

export const VOICES = [
  {
    id: "km_KH-mms-medium",
    name: "Sophea (សុភា)",
    language: "ភាសាខ្មែរ",
    detail: "Google AI Voice Clone · ភាសាខ្មែរ (ផ្អែម ពិរោះ)",
    gender: "Natural female (ផ្អែម ពិរោះ)",
    engine: "google",
    badge: "AI Clone",
    avatarUrl: "/assets/voice-avatars/km_KH-mms-medium.webp",
    sampleUrl: "/assets/voice-samples/km_KH-mms-medium.mp3",
  },
  {
    id: "af_heart",
    name: "Heart",
    language: "English",
    detail: "Kokoro 82M · q8",
    gender: "Warm female",
    engine: "kokoro",
    badge: "ONNX",
    avatarUrl: "/assets/voice-avatars/af_heart.webp",
    sampleUrl: "/assets/voice-samples/af_heart.mp3",
  },
  {
    id: "am_fenrir",
    name: "Fenrir",
    language: "English",
    detail: "Kokoro 82M · q8",
    gender: "Steady male",
    engine: "kokoro",
    badge: "ONNX",
    avatarUrl: "/assets/voice-avatars/am_fenrir.webp",
    sampleUrl: "/assets/voice-samples/am_fenrir.mp3",
  },
  {
    id: "de_DE-thorsten-medium",
    name: "Thorsten",
    language: "Deutsch",
    detail: "Piper ONNX · Deutsch",
    gender: "Natural male",
    engine: "piper",
    badge: "ONNX",
    avatarUrl: "/assets/voice-avatars/de_DE-thorsten-medium.webp",
    sampleUrl: "/assets/voice-samples/de_DE-thorsten-medium.mp3",
  },
  {
    id: "es_ES-davefx-medium",
    name: "DaveFX",
    language: "Español",
    detail: "Piper ONNX · Español",
    gender: "Natural male",
    engine: "piper",
    badge: "ONNX",
    avatarUrl: "/assets/voice-avatars/es_ES-davefx-medium.webp",
    sampleUrl: "/assets/voice-samples/es_ES-davefx-medium.mp3",
  },
  {
    id: "fr_FR-siwis-medium",
    name: "Siwis",
    language: "Français",
    detail: "Piper ONNX · Français",
    gender: "Natural voice",
    engine: "piper",
    badge: "ONNX",
    avatarUrl: "/assets/voice-avatars/fr_FR-siwis-medium.webp",
    sampleUrl: "/assets/voice-samples/fr_FR-siwis-medium.mp3",
  },
  {
    id: "it_IT-riccardo-x_low",
    name: "Riccardo",
    language: "Italiano",
    detail: "Piper ONNX · Italiano · x_low",
    gender: "Natural female",
    engine: "piper",
    badge: "ONNX",
    avatarUrl: "/assets/voice-avatars/it_IT-riccardo-x_low.webp",
    sampleUrl: "/assets/voice-samples/it_IT-riccardo-x_low.mp3",
  },
  {
    id: "pt_BR-faber-medium",
    name: "Faber",
    language: "Português",
    detail: "Piper ONNX · Português (Brasil)",
    gender: "Natural male",
    engine: "piper",
    badge: "ONNX",
    avatarUrl: "/assets/voice-avatars/pt_BR-faber-medium.webp",
    sampleUrl: "/assets/voice-samples/pt_BR-faber-medium.mp3",
  },
  {
    id: "ko_KR-mms-medium",
    name: "Minseo",
    language: "한국어",
    detail: "MMS VITS ONNX · 한국어",
    gender: "Natural male",
    engine: "mms",
    badge: "ONNX",
    avatarUrl: "/assets/voice-avatars/ko_KR-mms-medium.webp",
    sampleUrl: "/assets/voice-samples/ko_KR-mms-medium.mp3",
  },
  {
    id: "ja_JP-supertonic-f1",
    name: "Hikari",
    language: "日本語",
    detail: "Supertonic 3 ONNX · 日本語",
    gender: "Natural female",
    engine: "supertonic",
    badge: "ONNX",
    avatarUrl: "/assets/voice-avatars/ja_JP-supertonic-f1.webp",
    sampleUrl: "/assets/voice-samples/ja_JP-supertonic-f1.mp3",
  },
  {
    id: "vi_VN-mms-medium",
    name: "Linh",
    language: "Tiếng Việt",
    detail: "MMS VITS ONNX · Tiếng Việt",
    gender: "Natural male",
    engine: "mms",
    badge: "ONNX",
    avatarUrl: "/assets/voice-avatars/vi_VN-mms-medium.webp",
    sampleUrl: "/assets/voice-samples/vi_VN-mms-medium.mp3",
  },
  {
    id: "ru_RU-mms-medium",
    name: "Irina",
    language: "Русский",
    detail: "MMS VITS ONNX · Русский",
    gender: "Natural male",
    engine: "mms",
    badge: "ONNX",
    avatarUrl: "/assets/voice-avatars/ru_RU-mms-medium.webp",
    sampleUrl: "/assets/voice-samples/ru_RU-mms-medium.mp3",
  },
];

export const TOOL_RAIL = [
  { id: "media", label: "Media", icon: ImageSquare },
  { id: "text", label: "Text", icon: TextT },
  { id: "caption", label: "Captions", icon: ClosedCaptioning },
  { id: "voice-fl", label: "Voice FL", icon: SlidersHorizontal },
  { id: "smart", label: "Smart", icon: Scan },
  { id: "audio", label: "Audio", icon: MusicNote },
  { id: "voice-effects", label: "Voice Effect", icon: Waveform },
  { id: "auto-zoom", label: "Auto Zoom", icon: MagnifyingGlassPlus },
  { id: "transitions", label: "Transitions", icon: Intersect },
  { id: "dubber", label: "Dubber", icon: FilmSlate },
  { id: "effects", label: "Effects", icon: MagicWand },
  { id: "filters", label: "Filters", icon: Faders },
  { id: "plugins", label: "Plugins", icon: PlugsConnected },
  { id: "stickers", label: "Stickers", icon: Sticker },
];

export const RATIO_OPTIONS = [
  { id: "16:9", label: "16:9", width: 1280, height: 720 },
  { id: "9:16", label: "9:16", width: 720, height: 1280 },
  { id: "1:1", label: "1:1", width: 1080, height: 1080 },
  { id: "4:5", label: "4:5", width: 1080, height: 1350 },
];

const BASIC_FILTER_OPTIONS = [
  { id: "none", name: "Original", css: "none" },
  { id: "cool", name: "Cool Clear", css: "contrast(1.04) saturate(0.96) hue-rotate(8deg)" },
  { id: "film", name: "Film Vignette", css: "contrast(1.12) saturate(0.82) brightness(0.92)" },
  { id: "bright", name: "Bright Portrait", css: "brightness(1.08) contrast(0.98) saturate(1.05)" },
];

export const EFFECT_OPTIONS = [
  { id: "effect-clean", name: "Clear Enhance", css: "contrast(1.08) saturate(1.08) brightness(1.03)" },
  { id: "effect-soft", name: "Soft Glow", css: "brightness(1.08) contrast(0.94) saturate(1.06)" },
  { id: "effect-cinematic", name: "Cinematic", css: "contrast(1.18) saturate(0.86) brightness(0.92)" },
  { id: "effect-vivid", name: "Vivid", css: "contrast(1.08) saturate(1.28)" },
  { id: "effect-night", name: "Night Scene", css: "brightness(0.82) contrast(1.2) saturate(1.08)" },
  { id: "effect-warm", name: "Warm Tone", css: "sepia(0.16) saturate(1.12) brightness(1.04)" },
  { id: "effect-cold", name: "Cold Blue", css: "hue-rotate(12deg) saturate(0.98) contrast(1.06)" },
  { id: "effect-noir", name: "Noir Black & White", css: "grayscale(1) contrast(1.18)" },
  { id: "effect-dream", name: "Dreamy Glow", css: "brightness(1.1) saturate(1.18) blur(0.2px)" },
];

export const FILTER_OPTIONS = [...BASIC_FILTER_OPTIONS, ...EFFECT_OPTIONS];
export const VISUAL_STYLE_OPTIONS = FILTER_OPTIONS;

export const TRANSITION_CATEGORIES = [
  { id: "all", name: "All", khmer: "ទាំងអស់" },
  { id: "basic", name: "Basic", khmer: "ទូទៅ" },
  { id: "movement", name: "Movement", khmer: "ចលនា" },
  { id: "wipe", name: "Wipe & Split", khmer: "រុញកាត់" },
  { id: "effect", name: "Effects", khmer: "បែបពិសេស" },
];

export const TRANSITIONS = [
  { id: "none", name: "No Transition", category: "basic" },
  { id: "fade", name: "Fade", category: "basic" },
  { id: "flash", name: "Flash White", category: "basic" },
  { id: "flash-black", name: "Flash Black", category: "basic" },
  { id: "zoom", name: "Zoom In", category: "movement" },
  { id: "zoom-out", name: "Zoom Out", category: "movement" },
  { id: "push-left", name: "Push Left", category: "movement" },
  { id: "push-right", name: "Push Right", category: "movement" },
  { id: "spin", name: "Spin 360", category: "movement" },
  { id: "shake", name: "Camera Shake", category: "movement" },
  { id: "wipe-left", name: "Wipe Left", category: "wipe" },
  { id: "wipe-right", name: "Wipe Right", category: "wipe" },
  { id: "wipe-up", name: "Wipe Up", category: "wipe" },
  { id: "wipe-down", name: "Wipe Down", category: "wipe" },
  { id: "split", name: "Split Door", category: "wipe" },
  { id: "circle-iris", name: "Circle Iris", category: "wipe" },
  { id: "blur", name: "Blur Cut", category: "effect" },
  { id: "glitch", name: "Glitch RGB", category: "effect" },
  { id: "light-leak", name: "Light Leak", category: "effect" },
];

export const STICKER_PAGE_SIZE = 9;
export const DEFAULT_STICKER_SEGMENT_SECONDS = 3;

export const STICKER_CATEGORIES = [
  { id: "all", name: "All", nameEn: "All", kind: "stickerCategory" },
  { id: "trending", name: "Hot", nameEn: "Hot", kind: "stickerCategory" },
  { id: "voice", name: "Voiceover", nameEn: "Voiceover", kind: "stickerCategory" },
  { id: "reaction", name: "Reactions", nameEn: "Reactions", kind: "stickerCategory" },
  { id: "commerce", name: "Shop", nameEn: "Shop", kind: "stickerCategory" },
];

export const STICKER_LIBRARY = [
  { id: "trend-flame", name: "Hot Flame", nameEn: "Hot Flame", category: "trending", src: "/assets/stickers/trend-flame.png" },
  { id: "trend-spark", name: "Spark Burst", nameEn: "Spark Burst", category: "trending", src: "/assets/stickers/trend-spark.png" },
  { id: "trend-bolt", name: "Lightning", nameEn: "Lightning", category: "trending", src: "/assets/stickers/trend-bolt.png" },
  { id: "trend-starburst", name: "Starburst", nameEn: "Starburst", category: "trending", src: "/assets/stickers/trend-starburst.png" },
  { id: "trend-crown", name: "Crown", nameEn: "Crown", category: "trending", src: "/assets/stickers/trend-crown.png" },
  { id: "trend-megaphone", name: "Megaphone", nameEn: "Megaphone", category: "trending", src: "/assets/stickers/trend-megaphone.png" },
  { id: "trend-rocket", name: "Rocket", nameEn: "Rocket", category: "trending", src: "/assets/stickers/trend-rocket.png" },
  { id: "trend-confetti", name: "Confetti", nameEn: "Confetti", category: "trending", src: "/assets/stickers/trend-confetti.png" },
  { id: "trend-verified", name: "Verified Check", nameEn: "Verified Check", category: "trending", src: "/assets/stickers/trend-verified.png" },
  { id: "voice-mic", name: "Studio Mic", nameEn: "Studio Mic", category: "voice", src: "/assets/stickers/voice-mic.png" },
  { id: "voice-waveform", name: "Waveform", nameEn: "Waveform", category: "voice", src: "/assets/stickers/voice-waveform.png" },
  { id: "voice-headphones", name: "Headphones", nameEn: "Headphones", category: "voice", src: "/assets/stickers/voice-headphones.png" },
  { id: "voice-sound-ring", name: "Sound Ring", nameEn: "Sound Ring", category: "voice", src: "/assets/stickers/voice-sound-ring.png" },
  { id: "voice-caption-card", name: "Caption Card", nameEn: "Caption Card", category: "voice", src: "/assets/stickers/voice-caption-card.png" },
  { id: "voice-music-note", name: "Music Note", nameEn: "Music Note", category: "voice", src: "/assets/stickers/voice-music-note.png" },
  { id: "voice-speaker", name: "Speaker", nameEn: "Speaker", category: "voice", src: "/assets/stickers/voice-speaker.png" },
  { id: "voice-magic-wand", name: "Magic Wand", nameEn: "Magic Wand", category: "voice", src: "/assets/stickers/voice-magic-wand.png" },
  { id: "voice-timeline-marker", name: "Timeline Marker", nameEn: "Timeline Marker", category: "voice", src: "/assets/stickers/voice-timeline-marker.png" },
  { id: "react-heart", name: "Heart", nameEn: "Heart", category: "reaction", src: "/assets/stickers/react-heart.png" },
  { id: "react-like", name: "Like", nameEn: "Like", category: "reaction", src: "/assets/stickers/react-like.png" },
  { id: "react-smile", name: "Smile", nameEn: "Smile", category: "reaction", src: "/assets/stickers/react-smile.png" },
  { id: "react-surprise", name: "Surprise", nameEn: "Surprise", category: "reaction", src: "/assets/stickers/react-surprise.png" },
  { id: "react-eyes", name: "Bright Eyes", nameEn: "Bright Eyes", category: "reaction", src: "/assets/stickers/react-eyes.png" },
  { id: "react-applause", name: "Applause", nameEn: "Applause", category: "reaction", src: "/assets/stickers/react-applause.png" },
  { id: "react-chat", name: "Chat Bubble", nameEn: "Chat Bubble", category: "reaction", src: "/assets/stickers/react-chat.png" },
  { id: "react-dots", name: "Dot Bubble", nameEn: "Dot Bubble", category: "reaction", src: "/assets/stickers/react-dots.png" },
  { id: "react-alert", name: "Alert Burst", nameEn: "Alert Burst", category: "reaction", src: "/assets/stickers/react-alert.png" },
  { id: "shop-gift", name: "Gift", nameEn: "Gift", category: "commerce", src: "/assets/stickers/shop-gift.png" },
  { id: "shop-bag", name: "Shopping Bag", nameEn: "Shopping Bag", category: "commerce", src: "/assets/stickers/shop-bag.png" },
  { id: "shop-tag", name: "Blank Tag", nameEn: "Blank Tag", category: "commerce", src: "/assets/stickers/shop-tag.png" },
  { id: "shop-coins", name: "Coins", nameEn: "Coins", category: "commerce", src: "/assets/stickers/shop-coins.png" },
  { id: "shop-box", name: "Product Box", nameEn: "Product Box", category: "commerce", src: "/assets/stickers/shop-box.png" },
  { id: "shop-cart", name: "Cart", nameEn: "Cart", category: "commerce", src: "/assets/stickers/shop-cart.png" },
  { id: "shop-camera", name: "Camera", nameEn: "Camera", category: "commerce", src: "/assets/stickers/shop-camera.png" },
  { id: "shop-idea", name: "Idea Bulb", nameEn: "Idea Bulb", category: "commerce", src: "/assets/stickers/shop-idea.png" },
  { id: "shop-calendar", name: "Calendar", nameEn: "Calendar", category: "commerce", src: "/assets/stickers/shop-calendar.png" },
];

export const STICKERS = [
  { id: "none", name: "No Sticker", text: "" },
  ...STICKER_LIBRARY,
];

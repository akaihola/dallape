// Base URL of the Dallapé API. Empty string = same origin, which is how both
// local development and the Scaleway container serve it.
window.DALLAPE_API_BASE = "";

// Tab-local LRU retention; reload after changing settings. maxVideos/maxBytes
// require positive safe integers; invalid limits use these defaults.
// Byte accounting reserves three copies of encoded audio, including MSE/Blob input.
window.DALLAPE_AUDIO_CACHE = { enabled: true, maxVideos: 3, maxBytes: 192 * 1048576 };

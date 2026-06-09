function safeRedirect(url, fallback) {
  if (!url) return fallback;
  // Prevent protocol-relative redirects (//) or external site redirects (http/https)
  if (url.startsWith('http') || url.startsWith('//')) {
    return fallback;
  }
  return url;
}

module.exports = safeRedirect;

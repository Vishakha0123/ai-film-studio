// CloudFront Function (viewer request) for the site's Default (*) behavior.
// Page addresses like /director/story or /privacy have no file extension: serve the app (index.html).
// Files (/assets/app-123.js, /demo/cinema-ai-demo.mp4) pass through unchanged.
// Don't use CloudFront custom error pages instead: they would also turn the API's real 404s into the website page.
function handler(event) {
  var r = event.request;
  if (!r.uri.includes('.')) r.uri = '/index.html';
  return r;
}

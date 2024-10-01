document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-term');
    const excludeInput = document.getElementById('exclude-term');
    const resultCount = document.getElementById('result-count');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const closeBtn = document.getElementById('close-btn');

    let totalMatches = 0;
    let currentMatchIndex = 0;

    // Close the popup when the close button is clicked
    closeBtn.addEventListener('click', () => {
        window.close();
    });

    // Function to inject the content script
    function injectContentScript(callback) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0].id;

            // Send a test message to check if the content script is already injected
            chrome.tabs.sendMessage(tabId, { type: 'PING' }, (response) => {
                if (chrome.runtime.lastError) {
                    // Content script is not injected, so inject it
                    chrome.scripting.executeScript(
                        {
                            target: { tabId: tabId },
                            files: ['content.js'],
                        },
                        () => {
                            if (chrome.runtime.lastError) {
                                const errorMessage = chrome.runtime.lastError.message || 'Unknown error';
                                console.error('Error injecting content script:', errorMessage);
                                disableControls();
                                resultCount.textContent = 'N/A';
                                return;
                            }
                            callback(tabId);
                        }
                    );
                } else {
                    // Content script is already injected
                    callback(tabId);
                }
            });
        });
    }

    // Send search request to content script
    function performSearch() {
        const searchTerm = searchInput.value.trim();
        const excludeTerm = excludeInput.value.trim();

        injectContentScript((tabId) => {
            chrome.tabs.sendMessage(
                tabId,
                {
                    type: 'PERFORM_SEARCH',
                    searchTerm: searchTerm,
                    excludeTerm: excludeTerm,
                },
                (response) => {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || 'Unknown error';
                        console.error('Error performing search:', errorMessage);
                        resultCount.textContent = 'N/A';
                        disableControls();
                        return;
                    }
                    if (response) {
                        totalMatches = response.totalMatches;
                        currentMatchIndex = response.currentMatchIndex;
                        updateResultCount();
                        enableControls();
                    }
                }
            );
        });
    }

    function updateResultCount() {
        resultCount.textContent = `${currentMatchIndex} of ${totalMatches}`;
    }

    function disableControls() {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
    }

    function enableControls() {
        prevBtn.disabled = false;
        nextBtn.disabled = false;
    }

    searchInput.addEventListener('input', performSearch);
    excludeInput.addEventListener('input', performSearch);

    prevBtn.addEventListener('click', () => {
        injectContentScript((tabId) => {
            chrome.tabs.sendMessage(
                tabId,
                { type: 'NAVIGATE_MATCH', direction: 'prev' },
                (response) => {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || 'Unknown error';
                        console.error('Error navigating to previous match:', errorMessage);
                        disableControls();
                        return;
                    }
                    if (response) {
                        currentMatchIndex = response.currentMatchIndex;
                        updateResultCount();
                    }
                }
            );
        });
    });

    nextBtn.addEventListener('click', () => {
        injectContentScript((tabId) => {
            chrome.tabs.sendMessage(
                tabId,
                { type: 'NAVIGATE_MATCH', direction: 'next' },
                (response) => {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || 'Unknown error';
                        console.error('Error navigating to next match:', errorMessage);
                        disableControls();
                        return;
                    }
                    if (response) {
                        currentMatchIndex = response.currentMatchIndex;
                        updateResultCount();
                    }
                }
            );
        });
    });

    // Initial injection and check
    injectContentScript((tabId) => {
        chrome.tabs.sendMessage(
            tabId,
            { type: 'CHECK_CONTENT_SCRIPT' },
            (response) => {
                if (chrome.runtime.lastError) {
                    const errorMessage = chrome.runtime.lastError.message || 'Unknown error';
                    console.error('Error checking content script:', errorMessage);
                    disableControls();
                    resultCount.textContent = 'N/A';
                } else {
                    enableControls();
                }
            }
        );
    });
});

(function() {
    let markers = [];
    let currentIndex = -1;

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'PERFORM_SEARCH') {
            clearHighlights();
            if (request.searchTerm) {
                highlightMatches(request.searchTerm, request.excludeTerm);
                if (markers.length > 0) {
                    currentIndex = 1;
                    scrollToMarker(currentIndex - 1);
                } else {
                    currentIndex = 0;
                }
            } else {
                currentIndex = 0;
            }
            sendResponse({
                totalMatches: markers.length,
                currentMatchIndex: currentIndex
            });
        } else if (request.type === 'NAVIGATE_MATCH') {
            if (markers.length === 0) {
                sendResponse({ currentMatchIndex: 0 });
                return;
            }
            if (request.direction === 'next') {
                currentIndex = (currentIndex % markers.length) + 1;
            } else if (request.direction === 'prev') {
                currentIndex = (currentIndex - 2 + markers.length) % markers.length + 1;
            }
            scrollToMarker(currentIndex - 1);
            sendResponse({ currentMatchIndex: currentIndex });
        } else if (request.type === 'CHECK_CONTENT_SCRIPT') {
            sendResponse({ status: 'content_script_ready' });
        } else if (request.type === 'PING') {
            sendResponse({ status: 'content_script_alive' });
        }
    });

    function highlightMatches(searchTerm, excludeTerm) {
        const searchLower = searchTerm.toLowerCase();
        const excludeLower = excludeTerm ? excludeTerm.toLowerCase() : '';

        const regex = new RegExp(`(${escapeRegExp(searchLower)}|\\w*${escapeRegExp(searchLower)}\\w*)`, 'gi');

        traverseDOM(document.body, (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const nodeText = node.textContent.toLowerCase();
                if (nodeText.includes(searchLower)) {
                    const parent = node.parentNode;

                    // Skip non-visible elements
                    if (!isElementVisible(parent)) {
                        return;
                    }

                    const frag = document.createDocumentFragment();
                    let lastIndex = 0;
                    let match;
                    
                    while ((match = regex.exec(node.textContent)) !== null) {
                        const matchObject = {};
    
                        if (match[0].toLocaleLowerCase().includes(searchLower)) {
                            matchObject.word = match[0];
                            matchObject.exact = searchLower;
                        }

                        const { word, exact } = matchObject
                        
                        if (excludeLower && word.toLocaleLowerCase().includes(excludeLower)) continue

                        let text
                        let start
                        let end

                        if (word.toLocaleLowerCase() === exact) {
                            text = word
                            start = match.index;
                            end = regex.lastIndex
                        } else {
                            const wordIndex = word.toLocaleLowerCase().indexOf(exact) !== -1 ? word.toLocaleLowerCase().indexOf(exact) : 0

                            text = extractOriginalString(word, exact)
                            start = match.index + wordIndex
                            end = regex.lastIndex - Math.abs(regex.lastIndex - match.index - wordIndex - exact.length)
                        }

                        const before = document.createTextNode(node.textContent.substring(lastIndex, start));
                        frag.appendChild(before);

                        const highlightSpan = document.createElement('span');
                        highlightSpan.textContent = text;
                        highlightSpan.style.backgroundColor = 'yellow';
                        highlightSpan.classList.add('search-highlight');
                        frag.appendChild(highlightSpan);
                        markers.push(highlightSpan);

                        lastIndex = end;
                    }
                    const after = document.createTextNode(node.textContent.substring(lastIndex));
                    frag.appendChild(after);

                    parent.replaceChild(frag, node);
                }
            }
        });
    }

    function traverseDOM(node, callback) {
        if (node) {
            // Skip comment nodes
            if (node.nodeType === Node.COMMENT_NODE) {
                return;
            }

            // Skip script, style, and noscript tags
            const nodeName = node.nodeName.toLowerCase();
            if (['script', 'style', 'noscript'].includes(nodeName)) {
                return;
            }

            callback(node);

            node = node.firstChild;
            while (node) {
                traverseDOM(node, callback);
                node = node.nextSibling;
            }
        }
    }

    function isElementVisible(el) {
        if (el.nodeType !== Node.ELEMENT_NODE) {
            el = el.parentElement;
            if (!el) return false;
        }

        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
            return false;
        }

        // Check if the element or any of its parents are hidden
        if (el.offsetParent === null && style.position !== 'fixed') {
            return false;
        }

        return true;
    }

    function clearHighlights() {
        markers.forEach((marker) => {
            const parent = marker.parentNode;
            parent.replaceChild(document.createTextNode(marker.textContent), marker);
            parent.normalize();
        });
        markers = [];
        currentIndex = -1;
    }

    function scrollToMarker(index) {
        markers.forEach((marker, i) => {
            marker.style.backgroundColor = i === index ? 'orange' : 'yellow';
        });
        markers[index].scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function extractOriginalString(original, search) {
        const lowerSearch = search.toLowerCase();
        const result = [];
        
        const charCount = {};
        for (let char of lowerSearch) {
            charCount[char] = (charCount[char] || 0) + 1;
        }
    
        for (let char of lowerSearch) {
            for (let i = 0; i < original.length; i++) {
                if (original[i].toLowerCase() === char && charCount[char] > 0) {
                    result.push(original[i]);
                    charCount[char]--;
                    break;
                }
            }
        }
        
        return result.join('');
    }
})();

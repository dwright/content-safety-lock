/**
 * Amazon Blocked-Category Interceptor
 *
 * Design principle: only act on fields where the Amazon server has
 * *unambiguously* labeled the content's category. No keyword matching,
 * no heuristics based on rendering-layout signals.
 *
 * Tile-removal rules (all positive, any match removes the tile):
 *   Rule 1 - Browse Node: href or data-* attribute contains
 *            node=<id> or ai_<id> for any blocked browse node.
 *   Rule 3 - Storefront Tracking: data-acp-tracking JSON has ref_
 *            starting with ai_<id> for any blocked browse node.
 *
 * Blocked browse nodes:
 *   3777371    - Sexual Wellness
 *   7586174011 - Clothing, Shoes & Jewelry > Novelty & More > Exotic Apparel
 *
 * Known scope limitation - keyword search result pages:
 *   Plain keyword search pages (e.g. /s?k=vibrator) may display adult
 *   products. Individual tiles on those pages are NOT filtered. Amazon
 *   does not emit a per-tile "this is Sexual Wellness" label in that
 *   context; the signals above (browse node, storefront tracking) only
 *   appear on category and storefront pages. Category browse pages
 *   (e.g. /b?node=3777371), storefront referrals, and dedicated
 *   category carousels ARE filtered by Rules 1 and 3. The page-level
 *   detector in js/detectors/mature-content-detectors.js additionally
 *   blocks whole product detail pages whose breadcrumb is in a blocked
 *   category.
 *
 *   Signals investigated and rejected as insufficient:
 *     - mraiGl=gl_drugstore (on data-inline-expansion-slot-open-action):
 *         false positives on toothpaste, aspirin, shampoo, etc.; also
 *         only present on tiles with an inline expansion slot, so it
 *         misses most Sexual Wellness tiles anyway.
 *     - data-2257-checked="true": universal "2257 check was performed"
 *         bookkeeping flag attached to every product link on Amazon
 *         (toothpaste search page: 716 matches; aspirin: 679). Not a
 *         sexual-content indicator despite the legal-code reference.
 *     - data-component-id="31" review module and "social proof" badges:
 *         heuristics, present on many non-adult tiles.
 */
(function() {
    console.info('[CSL-Page] Amazon blocked-category interceptor active');

    // Prevent multiple injections
    if (window.__cslAmazonActive) {
        return;
    }
    window.__cslAmazonActive = true;

    const BLOCKED_NODES = [
        '3777371',    // Sexual Wellness
        '7586174011'  // Exotic Apparel
    ];

    // ============ Detection Rules ============

    /**
     * Rule 1: Browse Node Detection
     * Scan href and data-* attributes for node=<id> or ai_<id> for any
     * blocked browse node.
     */
    function hasBrowseNodeMatch(element) {
        const href = element.getAttribute('href') || '';
        for (const node of BLOCKED_NODES) {
            if (href.includes(`node=${node}`) || href.includes(`ai_${node}`)) {
                return true;
            }
        }

        const attributes = element.attributes;
        for (let i = 0; i < attributes.length; i++) {
            const attr = attributes[i];
            if (!attr.name.startsWith('data-')) {
                continue;
            }
            const value = attr.value || '';
            for (const node of BLOCKED_NODES) {
                if (value.includes(`node=${node}`) || value.includes(`ai_${node}`)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Rule 3: Storefront Tracking Detection
     * data-acp-tracking JSON has ref_ starting with ai_<id> for any
     * blocked browse node.
     */
    function hasStorefrontTrackingMatch(element) {
        function trackingBlobMatches(blob) {
            if (!blob) {
                return false;
            }
            try {
                const tracking = JSON.parse(blob);
                if (tracking.ref_) {
                    for (const node of BLOCKED_NODES) {
                        if (tracking.ref_.includes(`ai_${node}`)) {
                            return true;
                        }
                    }
                }
            }
            catch (e) {
                for (const node of BLOCKED_NODES) {
                    if (blob.includes(`"ref_":"ai_${node}"`) ||
                        blob.includes(`"ref_": "ai_${node}"`) ||
                        blob.includes(`ref_=ai_${node}`)) {
                        return true;
                    }
                }
            }
            return false;
        }

        const acpElements = element.querySelectorAll('[data-acp-tracking]');
        for (const el of acpElements) {
            if (trackingBlobMatches(el.getAttribute('data-acp-tracking'))) {
                return true;
            }
        }

        return trackingBlobMatches(element.getAttribute('data-acp-tracking'));
    }

    // ============ Main Detection Logic ============

    /**
     * Check if an element is a blocked-category product listing.
     * Logic: Rule1 OR Rule3. No negative constraints.
     */
    function isBlockedCategoryProduct(element) {
        return hasBrowseNodeMatch(element) || hasStorefrontTrackingMatch(element);
    }

    // ============ Product Container Detection ============

    /**
     * Find the product container for a given element
     * Walks up the DOM tree to find the product listing container
     */
    function findProductContainer(element) {
        // Ordered most-specific -> least-specific. The first match wins,
        // so we stop at the tightest tile container and never climb up to
        // large regions like .a-section or the whole body. Prefer the
        // *outer* product tile over inner telemetry wrappers so that
        // removal affects the whole tile rather than a nested
        // Add-to-Cart block. '[data-csa-c-item-id]' is intentionally
        // last because Amazon attaches it to many levels of the tile's
        // DOM.
        const containerSelectors = [
            'li.a-carousel-card',
            '[data-component-type="s-search-result"]',
            '.s-result-item',
            '.s-card-container',
            '[data-asin]:not([data-asin=""])',
            '[data-csa-c-item-id]'
        ];

        let current = element;
        let depth = 0;
        const maxDepth = 15;

        while (current && current !== document.body && depth < maxDepth) {
            if (current.matches) {
                for (const selector of containerSelectors) {
                    if (current.matches(selector)) {
                        return current;
                    }
                }
            }
            current = current.parentElement;
            depth++;
        }

        return null;
    }

    /**
     * Find the enclosing carousel container, if any.
     * Used to remove entire sexual-wellness carousels as a unit when the
     * carousel heading itself links to the Sexual Wellness category.
     */
    function findCarouselContainer(element) {
        const carouselSelectors = [
            '.a-carousel-container',
            '[data-a-carousel-options]',
            '[class*="CarouselContainer"]'
        ];
        let current = element;
        let depth = 0;
        const maxDepth = 20;
        while (current && current !== document.body && depth < maxDepth) {
            if (current.matches) {
                for (const selector of carouselSelectors) {
                    if (current.matches(selector)) {
                        return current;
                    }
                }
            }
            current = current.parentElement;
            depth++;
        }
        return null;
    }

    // ============ Content Removal ============

    /**
     * Remove/hide a product listing
     */
    function removeProductListing(container, detectionInfo) {
        if (container.getAttribute('data-csl-processed')) {
            return;
        }
        container.setAttribute('data-csl-processed', 'true');

        console.info('[CSL-Page] Removing blocked-category product listing', {
            rules: detectionInfo,
            asin: container.getAttribute('data-asin') || 'unknown'
        });

        // Create replacement message
        const replacement = document.createElement('div');
        replacement.style.cssText = `
            padding: 16px;
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 8px;
            margin: 8px 0;
            text-align: center;
            color: #666;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
        `;
        replacement.textContent = '🚫 Product hidden by Content Safety Lock.';

        container.replaceWith(replacement);
    }

    // ============ DOM Scanning ============

    /**
     * Scan for elements with any blocked-category markers.
     * Returns a deduplicated set of raw trigger elements.
     */
    function findTriggerElements(root) {
        const triggers = new Set();

        // Rule 1: href containing node=<id> or ai_<id> for any blocked node.
        const rule1Selector = BLOCKED_NODES
            .flatMap(n => [`[href*="node=${n}"]`, `[href*="ai_${n}"]`])
            .join(', ');
        root.querySelectorAll(rule1Selector).forEach(el => triggers.add(el));

        // Rule 3: data-acp-tracking referencing ai_<id> for any blocked node.
        const rule3Selector = BLOCKED_NODES
            .map(n => `[data-acp-tracking*="ai_${n}"]`)
            .join(', ');
        root.querySelectorAll(rule3Selector).forEach(el => triggers.add(el));

        return triggers;
    }

    /**
     * Scan a container for blocked-category content to filter.
     *
     * Two-pass strategy:
     *   Pass 1 - Carousel level: If a carousel contains two or more
     *            triggers, remove the whole carousel. This catches pages
     *            like "Everyday Essentials" that display a dedicated
     *            blocked-category carousel.
     *   Pass 2 - Item level: For remaining triggers, find and remove the
     *            closest product tile.
     */
    function scanForProducts(root) {
        if (!root || !root.querySelectorAll) {
            return;
        }

        const triggers = findTriggerElements(root);
        if (triggers.size === 0) {
            return;
        }

        console.debug('[CSL-Page] Amazon: found', triggers.size, 'blocked-category trigger elements');

        const carouselsToRemove = new Set();
        const itemsToRemove = new Set();

        // Pass 1: Group triggers by enclosing carousel. If a carousel
        // contains multiple triggers, remove it wholesale.
        const triggersByCarousel = new Map();
        const nonCarouselTriggers = [];

        for (const trigger of triggers) {
            const carousel = findCarouselContainer(trigger);
            if (carousel) {
                if (!triggersByCarousel.has(carousel)) {
                    triggersByCarousel.set(carousel, []);
                }
                triggersByCarousel.get(carousel).push(trigger);
            }
            else {
                nonCarouselTriggers.push(trigger);
            }
        }

        for (const [carousel, carouselTriggers] of triggersByCarousel) {
            if (carousel.getAttribute('data-csl-processed')) {
                continue;
            }
            // A carousel with multiple blocked-category references is
            // almost certainly a dedicated blocked-category carousel.
            if (carouselTriggers.length >= 2) {
                carouselsToRemove.add(carousel);
            }
            else {
                // Only a single trigger inside the carousel: treat as
                // per-item removal instead.
                nonCarouselTriggers.push(...carouselTriggers);
            }
        }

        // Pass 2: per-item removal for remaining triggers.
        for (const trigger of nonCarouselTriggers) {
            const container = findProductContainer(trigger);
            if (!container) {
                continue;
            }
            if (container.getAttribute('data-csl-processed')) {
                continue;
            }
            if (carouselsToRemove.has(container)) {
                continue;
            }
            itemsToRemove.add(container);
        }

        // Apply removals.
        for (const carousel of carouselsToRemove) {
            removeProductListing(carousel, { scope: 'carousel' });
        }
        for (const item of itemsToRemove) {
            removeProductListing(item, { scope: 'item' });
        }

        const totalRemoved = carouselsToRemove.size + itemsToRemove.size;
        if (totalRemoved > 0) {
            console.info(
                `[CSL-Page] Removed ${carouselsToRemove.size} carousel(s) and ` +
                `${itemsToRemove.size} item(s) from blocked categories`
            );
        }
    }

    /**
     * Perform initial scan of the page
     */
    function performInitialScan() {
        console.debug('[CSL-Page] Amazon: Running initial scan...');

        // Wait for body to be available
        if (!document.body) {
            setTimeout(performInitialScan, 100);
            return;
        }

        scanForProducts(document.body);
    }

    // ============ Mutation Observer ============

    /**
     * Watch for dynamically added content
     */
    const observer = new MutationObserver((mutations) => {
        // Any added element subtree may contain lazy-loaded product tiles
        // (carousel cards, infinite scroll results, etc.). Rather than
        // checking specific selectors up front, just debounce a re-scan
        // whenever new elements appear.
        let hasAddedElements = false;
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        hasAddedElements = true;
                        break;
                    }
                }
            }
            if (hasAddedElements) {
                break;
            }
        }

        if (hasAddedElements) {
            clearTimeout(window.__cslAmazonScanTimeout);
            window.__cslAmazonScanTimeout = setTimeout(() => {
                scanForProducts(document.body);
            }, 200);
        }
    });

    // ============ Initialization ============

    function init() {
        console.info('[CSL-Page] Amazon interceptor initializing...');

        // Run initial scan
        performInitialScan();

        // Start observing for dynamic content
        const observeTarget = document.body || document.documentElement;
        observer.observe(observeTarget, {
            childList: true,
            subtree: true
        });

        // Re-scan after common Amazon lazy-load delays
        setTimeout(() => scanForProducts(document.body), 500);
        setTimeout(() => scanForProducts(document.body), 1500);
        setTimeout(() => scanForProducts(document.body), 3000);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    }
    else {
        init();
    }

})();

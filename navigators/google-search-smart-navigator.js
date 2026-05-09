"use strict";
/**
 * @description Handles Google search with smart memory capabilities to learn and recall target URL positions.
 * @author UWAS.DEV
 * @date 2026-01-02
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
const modules_helper_1 = require("../modules-helper");
class GoogleSearchSmartNavigator extends modules_helper_1.ModulesHelper.BaseNavigator {
    // --- Smart Memory Storage ---
    // Stores the last known page number for a given search term and target domain.
    // Key format: "searchTerm|targetDomain" -> Value: pageNumber (1-based)
    static smartMemory = new Map();
    static MAX_MEMORY_SIZE = 100;
    GOOGLE_SEARCH = {
        BASE_URL: 'https://www.google.com',
        SEARCH_INPUT_SELECTOR: 'textarea[name="q"]',
        COOKIE_ACCEPT_SELECTOR: '#L2AGLb',
        RESULTS_CONTAINER_SELECTOR: '#search',
        RESULT_ITEM_SELECTOR: 'div.g',
        // Dynamic selector for pagination: "#botstuff > div > div:nth-child(4) > table > tbody > tr > td:nth-child($page+1) > a"
        // Note: Google's DOM structure for pagination can vary, but we will stick to the user-provided structure as a base.
        PAGINATION_CONTAINER_SELECTOR: '#botstuff > div > div[jscontroller] > table > tbody > tr',
        LOCATION_PROMPT_SELECTOR: 'span > div > div.DiqQLb.wHYlTd > div.mpQYc > g-raised-button > div > div',
    };
    searchTermsPattern = /^[a-zA-Z0-9\s\-_.,:;!?'"()&%#@*+=[\]{}<>|\\^~`\u00E7\u00C7\u011F\u011E\u0131\u0130\u00F6\u00D6\u015F\u015E\u00FC\u00DC\u0103\u0102\u00E2\u00C2\u00EE\u00CE\u0219\u0218\u021B\u021A\u0163\u0162]+$/;
    searchTerm = null;
    searchResults = [];
    static getMetadata() {
        return {
            id: 'google_search_smart',
            title: 'Google Search Smart',
            description: 'Performs a Google search, learns target URL position, and navigates directly to it in subsequent runs.',
            category: 'search',
            enabled: true,
            order: 20,
            version: '5.0.0',
        };
    }
    getNavigatorType() {
        return GoogleSearchSmartNavigator.getMetadata().id;
    }
    getConfigSchema() {
        return {
            type: 'object',
            properties: {
                searchTerms: {
                    type: 'array',
                    items: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 500,
                        pattern: this.searchTermsPattern.source,
                    },
                    description: 'The terms to search for on Google.',
                },
                waitForResults: {
                    type: 'boolean',
                    default: true,
                    description: 'Whether to wait for search results to load before considering the execution complete.',
                },
            },
            required: ['searchTerms'],
            additionalProperties: false,
        };
    }
    validate(config) {
        const { searchTerms } = config;
        if (!Array.isArray(searchTerms) || searchTerms.length === 0) {
            throw this._createValidationError('searchTerms', searchTerms, 'format', 'searchTerms must be a non-empty array of strings.');
        }
        for (const term of searchTerms) {
            if (typeof term !== 'string' || !this.searchTermsPattern.test(term)) {
                throw this._createValidationError('searchTerms', term, 'format', `Search term '${term}' contains invalid characters.`);
            }
        }
        this._logInfo('GoogleSearchSmartNavigator configuration validated successfully.');
        return Promise.resolve();
    }
    async _run(page, options) {
        const startTime = modules_helper_1.ModulesHelper.Helpers.getTimestamp();
        const { navigator: moduleConfig } = options.config;
        try {
            await this.validate(moduleConfig);
            const { completedBehaviors } = await this.interactionService.executeBehaviorLoop({
                page,
                options,
                behaviorSelector: this._selectNavigatorPageBehaviors.bind(this),
                behaviorExecutor: this._executeNavigatorPageBehavior.bind(this),
                loopType: 'google_search_smart_flow',
                executionMode: 'sequential',
            });
            // Assert the final state ONLY if a targetURL was provided.
            const { targetURL } = moduleConfig;
            if (targetURL) {
                this._logInfo('Asserting final state against the target URL.', { targetURL });
                const finalExpectedState = {
                    customValidation: (p) => Promise.resolve(modules_helper_1.ModulesHelper.Helpers.isSameDomain(p.url(), targetURL)),
                    urlMustNotContain: ['captcha', 'error', 'google.com'],
                };
                await this.nav.assertNavigationState(page, finalExpectedState);
            }
            const endTime = modules_helper_1.ModulesHelper.Helpers.getTimestamp();
            const duration = modules_helper_1.ModulesHelper.Helpers.getTimeDifference(startTime, endTime);
            const result = {
                success: true,
                data: {
                    searchTerm: this.searchTerm,
                    url: page.url(),
                    resultsCount: this.searchResults.length,
                    searchResults: this.searchResults,
                    duration,
                    timestamp: endTime,
                },
            };
            this._logInfo('Google smart search navigation completed.', {
                searchTerm: this.searchTerm,
                targetURL: moduleConfig?.targetURL || 'N/A',
                completedBehaviors,
                duration: `${duration}ms`,
            });
            return result;
        }
        catch (error) {
            const endTime = modules_helper_1.ModulesHelper.Helpers.getTimestamp();
            const duration = modules_helper_1.ModulesHelper.Helpers.getTimeDifference(startTime, endTime);
            this._logError('Google smart search execution failed', { error: error.message, duration });
            throw await this._handleNavigationError(error, {
                operation: 'google_search_smart',
                searchTerms: moduleConfig.searchTerms,
                duration,
            });
        }
    }
    _selectNavigatorPageBehaviors() {
        return [
            { name: 'selectSearchTerm', optional: false },
            { name: 'navigateToGoogle', optional: false },
            { name: 'handleCookieConsent', optional: false },
            { name: 'preSearchWait', optional: true },
            { name: 'typeSearchTerm', optional: false },
            { name: 'postSearchWait', optional: true },
            { name: 'performSmartSearch', optional: false }, // Replaces findAndClickTarget
            { name: 'extractResults', optional: false },
        ];
    }
    async _executeNavigatorPageBehavior(behaviorName, page, options) {
        const { navigator: moduleConfig } = options.config;
        const targetURL = moduleConfig?.targetURL;
        let success = false;
        switch (behaviorName) {
            case 'selectSearchTerm':
                success = this._behaviorSelectSearchTerm(moduleConfig);
                break;
            case 'navigateToGoogle':
                this._logInfo(`Navigating to Google homepage: ${this.GOOGLE_SEARCH.BASE_URL}`);
                await this.nav.navigate(page, this.GOOGLE_SEARCH.BASE_URL, { ...options, timeout: this.config.navigationTimeout });
                success = true;
                break;
            case 'handleCookieConsent':
                await this._handleCookieConsent(page);
                success = true;
                break;
            case 'preSearchWait':
                await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(2000, 4000));
                success = true;
                break;
            case 'typeSearchTerm':
                success = await this._behaviorTypeSearchTerm(page);
                break;
            case 'postSearchWait':
                await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(2000, 3000));
                success = true;
                break;
            case 'performSmartSearch':
                if (!targetURL) {
                    this._logDebug('No targetURL provided, skipping smart search.');
                    success = true;
                }
                else {
                    success = await this._performSmartSearch(page, targetURL, options);
                }
                break;
            case 'extractResults':
                if (!targetURL && moduleConfig.waitForResults !== false) {
                    this.searchResults = await this._extractSearchResults(page);
                }
                success = true;
                break;
            default:
                this._logWarn(`Unknown navigator behavior: ${behaviorName}`);
                break;
        }
        if (!success) {
            this._logDebug(`ModulesHelper.Behavior '${behaviorName}' did not execute successfully or was skipped.`);
        }
    }
    // --- Helper Methods & Behaviors ---
    _behaviorSelectSearchTerm(config) {
        const { searchTerms } = config;
        this.searchTerm = modules_helper_1.ModulesHelper.Helpers.getRandomElement(searchTerms) || null;
        if (!this.searchTerm) {
            throw this._createError('Could not select a search term.', 'VALIDATION_ERROR');
        }
        this._logInfo(`Selected search term: '${this.searchTerm}'`);
        return true;
    }
    async _behaviorTypeSearchTerm(page) {
        if (!this.searchTerm) {
            throw new Error('Search term not selected.');
        }
        this._logInfo(`Typing search term: '${this.searchTerm}'`);
        const clickSuccess = await this.interactionService.handleElementInteraction(page, {
            selectors: [this.GOOGLE_SEARCH.SEARCH_INPUT_SELECTOR],
            actions: ['hover', 'wait', 'click'],
            maxRetries: 3,
            interactionOptions: {
                hover: { delay: { min: 500, max: 1000 } },
                click: { delay: { min: 100, max: 200 } },
            },
        });
        if (!clickSuccess) {
            throw this._createError('Failed to click search input.', 'INTERACTION_FAILED');
        }
        await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(500, 1000));
        const typeSuccess = await this.interactionService.handleElementInteraction(page, {
            selectors: [this.GOOGLE_SEARCH.SEARCH_INPUT_SELECTOR],
            actions: ['type', 'wait', 'enter'],
            typeText: this.searchTerm,
            expectsNavigation: true,
            maxRetries: 1,
            interactionOptions: {
                type: { delay: { min: 80, max: 160 }, typos: { min: 0, max: 2 } },
            },
        });
        if (!typeSuccess) {
            throw this._createError('Failed to type/submit search term.', 'INTERACTION_FAILED');
        }
        await this.nav.assertNavigationState(page, {
            urlShouldMatch: /google\.com\/search/,
            bodyShouldContain: [this.GOOGLE_SEARCH.RESULTS_CONTAINER_SELECTOR],
        });
        return true;
    }
    /**
     * @method _performSmartSearch
     * @description Core logic for "Smart Search". Uses a spiral search pattern centered around
     *              a remembered page position to efficiently locate the target URL.
     */
    async _performSmartSearch(page, targetURL, options) {
        if (!this.searchTerm) {
            throw new Error('Search term is missing for smart search.');
        }
        const memoryKey = this._generateMemoryKey(this.searchTerm, targetURL);
        const rememberedPage = GoogleSearchSmartNavigator.smartMemory.get(memoryKey);
        const maxPagesToSearch = 10;
        const startPage = rememberedPage || 1;
        // Generate the spiral search order (e.g., Center, Left-1, Right+1, Left-2...)
        const pageOrder = this._generateSpiralOrder(startPage, maxPagesToSearch);
        this._logInfo('Starting Smart Spiral Search', {
            searchTerm: this.searchTerm,
            targetURL,
            rememberedPage,
            searchOrder: pageOrder,
        });
        for (const pageNum of pageOrder) {
            // Feed Watchdog to prevent safety net timeouts during deep scans
            if (options.watchdogFeed) {
                options.watchdogFeed();
            }
            // Navigate to the specific page
            const navSuccess = await this._navigateToResultPage(page, pageNum, options);
            if (!navSuccess) {
                this._logWarn(`Could not navigate to page ${pageNum}. Skipping this page in spiral sequence.`);
                continue;
            }
            // Scan the page
            this._logInfo(`Scanning page ${pageNum} for target...`);
            const found = await this._scanPageForTarget(page, targetURL);
            if (found) {
                this._logInfo(`Target found on page ${pageNum}. Updating memory.`);
                this._updateMemory(memoryKey, pageNum);
                return true;
            }
        }
        throw this._createError(`Target URL "${targetURL}" not found within the search range (Spiral scan of ${maxPagesToSearch} pages).`, 'TARGET_NOT_FOUND');
    }
    /**
     * @method _generateSpiralOrder
     * @description Generates a sequence of page numbers starting from the center and spiraling outwards.
     *              Example: Center=5 -> [5, 4, 6, 3, 7, 2, 8, 1, 9, 10]
     * @param center The starting page number (remembered page).
     * @param max The maximum number of pages to include.
     */
    _generateSpiralOrder(center, max) {
        const sequence = [center];
        let offset = 1;
        let keepSearching = true;
        while (keepSearching) {
            const left = center - offset;
            const right = center + offset;
            let added = false;
            if (left >= 1) {
                sequence.push(left);
                added = true;
            }
            if (right <= max) {
                sequence.push(right);
                added = true;
            }
            if (!added && (left < 1 && right > max)) {
                keepSearching = false;
            }
            offset++;
        }
        return [...new Set(sequence)].filter(p => p >= 1 && p <= max);
    }
    /**
     * @method _scanPageForTarget
     * @description Scans the current page for the target URL and clicks it if found.
     */
    async _scanPageForTarget(page, targetURL) {
        await modules_helper_1.ModulesHelper.Helpers.scrollPage(page, { direction: 'down', amount: { min: 400, max: 800 } });
        await this._handlePotentialLocationPrompt(page);
        await modules_helper_1.ModulesHelper.Helpers.scrollPage(page, { direction: 'up', amount: { min: 200, max: 400 } });
        const targetFound = await this.interactionService.handleElementInteraction(page, {
            selectors: ['#rso .MjjYud a[href] h3'],
            actions: ['hover', 'wait', 'click'],
            expectsNavigation: true,
            navigationVerification: { expectedUrl: targetURL, timeout: this.nav.pageLoadTimeout },
            filter: async (element) => {
                const href = await element.evaluate((el) => el.closest('a')?.getAttribute('href'));
                return href && !href.includes('google.com/search') && modules_helper_1.ModulesHelper.Helpers.isSameDomain(href, targetURL);
            },
            maxRetries: 3,
            interactionOptions: {
                scroll: { delay: { min: 40, max: 80 } },
                hover: { delay: { min: 400, max: 800 } },
                click: { delay: { min: 80, max: 200 } },
            },
        });
        return targetFound;
    }
    /**
     * @method _navigateToResultPage
     * @description Navigates directly to a specific search result page using the footer paginator.
     */
    async _navigateToResultPage(page, pageNumber, options) {
        this._logInfo(`Attempting to navigate directly to page ${pageNumber}.`);
        if (options.watchdogFeed) {
            options.watchdogFeed();
        }
        // If we want page 1, we can just click the logo or re-search, but clicking the "1" in footer is also valid if visible.
        // However, usually "1" is not a link if we are on page 1.
        const currentPage = await this._getCurrentPageNumber(page);
        if (currentPage === pageNumber) {
            this._logDebug(`Already on page ${pageNumber}.`);
            return true;
        }
        // Selector logic based on user instruction: "#botstuff ... td:nth-child($page+1) > a"
        // Note: The 'td' index is usually pageNumber + 1 because the first td might be 'Previous' or empty padding.
        // We'll try to be robust.
        // 1st page link is usually in 2nd td (if Previous is hidden) or 3rd (if Previous is shown).
        // Let's rely on aria-label or text content which is safer, but strictly following the user's "nth-child" logic requires
        // us to construct the selector dynamically.
        // Constructing the selector based on user's pattern: td:nth-child($page+1)
        // We assume the user's observation holds true for the standard desktop layout.
        // However, we must be careful: if we are on page 5, the pagination bar shifts.
        // The user's provided logic "td:nth-child(2) = 1st page" implies a static list, which Google is NOT always.
        // Google pagination is a sliding window (e.g., 3 4 5 6 7 8 9 10 11 12).
        // So "ModulesHelper.Page 6" is not always `td:nth-child(7)`.
        // BETTER APPROACH: Find the link with `aria-label="ModulesHelper.Page X"` or text "X".
        // This is far more robust than nth-child which breaks instantly on sliding windows.
        const pageLinkSelector = `a[aria-label="ModulesHelper.Page ${pageNumber}"]`;
        this._logDebug(`Looking for pagination link: ${pageLinkSelector}`);
        try {
            const link = page.locator(pageLinkSelector).first();
            if (await link.isVisible()) {
                await this.nav.navigateAfterAction(page, () => link.click(), options);
                await modules_helper_1.ModulesHelper.Helpers.delay(2000); // Wait for results to refresh
                return true;
            }
            // Fallback: Try to find by text content if aria-label fails
            const linkByText = page.locator(`a.fl:text-is("${pageNumber}")`).first();
            if (await linkByText.isVisible()) {
                await this.nav.navigateAfterAction(page, () => linkByText.click(), options);
                await modules_helper_1.ModulesHelper.Helpers.delay(2000);
                return true;
            }
            this._logWarn(`Pagination link for page ${pageNumber} not visible.`);
            return false;
        }
        catch (e) {
            this._logWarn(`Error navigating to page ${pageNumber}`, { error: e });
            return false;
        }
    }
    async _getCurrentPageNumber(page) {
        try {
            // The current page usually is a `td` without a link, just text, or `span` with class `current` equivalent.
            // Google uses <td class="YyVfkd">1</td> for the current page (unlinked).
            const currentTd = page.locator('td.YyVfkd');
            if (await currentTd.isVisible()) {
                const text = await currentTd.innerText();
                return parseInt(text, 10) || 1;
            }
            return 1; // Default to 1 if not found
        }
        catch {
            return 1;
        }
    }
    _updateMemory(key, value) {
        // LRU Logic: Delete and re-set to update insertion order
        if (GoogleSearchSmartNavigator.smartMemory.has(key)) {
            GoogleSearchSmartNavigator.smartMemory.delete(key);
        }
        GoogleSearchSmartNavigator.smartMemory.set(key, value);
        // Enforce size limit
        if (GoogleSearchSmartNavigator.smartMemory.size > GoogleSearchSmartNavigator.MAX_MEMORY_SIZE) {
            const firstKey = GoogleSearchSmartNavigator.smartMemory.keys().next().value;
            if (firstKey) {
                GoogleSearchSmartNavigator.smartMemory.delete(firstKey);
            }
        }
    }
    _generateMemoryKey(searchTerm, targetDomain) {
        // Normalize to ensure consistency
        return `${searchTerm.trim().toLowerCase()}|${new URL(targetDomain).hostname.replace('www.', '')}`;
    }
    async _handleCookieConsent(page) {
        try {
            if (await page.isVisible(this.GOOGLE_SEARCH.COOKIE_ACCEPT_SELECTOR)) {
                await page.click(this.GOOGLE_SEARCH.COOKIE_ACCEPT_SELECTOR);
                await modules_helper_1.ModulesHelper.Helpers.delay(500);
            }
        }
        catch (error) {
            this._logWarn('Cookie consent error (non-fatal)', { error });
        }
    }
    async _handlePotentialLocationPrompt(page) {
        try {
            if (await page.isVisible(this.GOOGLE_SEARCH.LOCATION_PROMPT_SELECTOR)) {
                await page.click(this.GOOGLE_SEARCH.LOCATION_PROMPT_SELECTOR);
                await modules_helper_1.ModulesHelper.Helpers.delay(1000);
            }
        }
        catch (error) {
            // Ignore
        }
    }
    async _extractSearchResults(page) {
        // Basic extraction implementation (kept from original for compatibility)
        try {
            await page.waitForSelector(this.GOOGLE_SEARCH.RESULTS_CONTAINER_SELECTOR, { timeout: 5000 });
            const resultItems = await page.locator(this.GOOGLE_SEARCH.RESULT_ITEM_SELECTOR).all();
            const results = [];
            for (let i = 0; i < resultItems.length; i++) {
                const url = await resultItems[i].locator('a').first().getAttribute('href').catch(() => null);
                const title = await resultItems[i].locator('h3').innerText().catch(() => '');
                if (url) {
                    results.push({ position: i + 1, title, url, snippet: '' });
                }
            }
            return results;
        }
        catch (e) {
            this._logWarn('Failed to extract results', { error: e });
            return [];
        }
    }
}
exports.default = GoogleSearchSmartNavigator;
//# sourceMappingURL=google-search-smart-navigator.js.map
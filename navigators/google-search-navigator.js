"use strict";
/**
 * @description Handles Google search by simulating human-like interaction on the Google homepage.
 * @author UWAS.DEV
 * @date 2025-10-15
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
const modules_helper_1 = require("../modules-helper");
class GoogleSearchNavigator extends modules_helper_1.ModulesHelper.BaseNavigator {
    GOOGLE_SEARCH = {
        BASE_URL: 'https://www.google.com',
        SEARCH_INPUT_SELECTOR: 'textarea[name="q"]',
        COOKIE_ACCEPT_SELECTOR: '#L2AGLb', // Selector for the "Accept all" button in cookie consent
        RESULTS_CONTAINER_SELECTOR: '#search',
        RESULT_ITEM_SELECTOR: 'div.g',
        NEXT_PAGE_BUTTON_SELECTOR: '#pnnext',
        // Selector provided by the user for a potential location permission prompt.
        // Updated to use a more robust selector without dynamic IDs as per user instructions.
        LOCATION_PROMPT_SELECTOR: 'span > div > div.DiqQLb.wHYlTd > div.mpQYc > g-raised-button > div > div',
    };
    // Supports Turkish and Romanian characters
    // Uses Unicode escapes to avoid source encoding issues.
    // TR: ç=\u00E7 Ç=\u00C7 ğ=\u011F Ğ=\u011E ı=\u0131 İ=\u0130 ö=\u00F6 Ö=\u00D6 ş=\u015F Ş=\u015E ü=\u00FC Ü=\u00DC
    // RO: ă=\u0103 Ă=\u0102 â=\u00E2 Â=\u00C2 î=\u00EE Î=\u00CE ș=\u0219 Ș=\u0218 ț=\u021B Ț=\u021A ţ=\u0163 Ţ=\u0162
    searchTermsPattern = /^[a-zA-Z0-9\s\-_.,:;!?'"()&%#@*+=[\]{}<>|\\^~`\u00E7\u00C7\u011F\u011E\u0131\u0130\u00F6\u00D6\u015F\u015E\u00FC\u00DC\u0103\u0102\u00E2\u00C2\u00EE\u00CE\u0219\u0218\u021B\u021A\u0163\u0162]+$/;
    searchTerm = null;
    searchResults = [];
    static getMetadata() {
        return {
            id: 'google_search',
            title: 'Google Search',
            description: 'Performs a human-like Google search and navigates to the results page.',
            category: 'search',
            enabled: true,
            order: 20,
            version: '4.0.0',
        };
    }
    getNavigatorType() {
        return GoogleSearchNavigator.getMetadata().id;
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
        this._logInfo('GoogleSearchNavigator configuration validated successfully.');
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
                loopType: 'google_search_flow',
                executionMode: 'sequential',
            });
            // Assert the final state after the behavior loop completes.
            const { targetURL } = moduleConfig;
            // Assert the final state ONLY if a targetURL was provided.
            // If not, the state has already been asserted within the 'typeSearchTerm' behavior.
            if (targetURL) {
                this._logInfo('Asserting final state against the target URL.', { targetURL });
                const finalExpectedState = {
                    customValidation: (p) => Promise.resolve(modules_helper_1.ModulesHelper.Helpers.isSameDomain(p.url(), targetURL)),
                    urlMustNotContain: ['captcha', 'error', 'google.com'], // Should not be on a Google page anymore
                };
                await this.nav.assertNavigationState(page, finalExpectedState);
            }
            else {
                this._logInfo('No targetURL provided. Final state assertion skipped as it was handled within the behavior loop.');
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
            this._logInfo('Google search navigation completed and state asserted successfully', {
                searchTerm: this.searchTerm,
                targetURL: moduleConfig?.targetURL || 'N/A',
                found: Boolean(moduleConfig?.targetURL),
                completedBehaviors,
                duration: `${duration}ms`,
            });
            return result;
        }
        catch (error) {
            const endTime = modules_helper_1.ModulesHelper.Helpers.getTimestamp();
            const duration = modules_helper_1.ModulesHelper.Helpers.getTimeDifference(startTime, endTime);
            this._logError('Google search execution failed', { error: error.message, duration });
            throw await this._handleNavigationError(error, {
                operation: 'google_search',
                searchTerms: moduleConfig.searchTerms,
                duration,
            });
        }
    }
    _selectNavigatorPageBehaviors() {
        const behaviors = [
            { name: 'selectSearchTerm', optional: false },
            { name: 'navigateToGoogle', optional: false },
            { name: 'handleCookieConsent', optional: false },
            { name: 'preSearchWait', optional: true },
            { name: 'preSearchMouseMove', optional: true },
            { name: 'typeSearchTerm', optional: false },
            { name: 'postSearchWait', optional: true },
            { name: 'findAndClickTarget', optional: false },
            { name: 'extractResults', optional: false },
        ];
        return behaviors;
    }
    async _executeNavigatorPageBehavior(behaviorName, page, options) {
        const { navigator: moduleConfig } = options.config;
        const targetURL = moduleConfig?.targetURL;
        let success = false;
        switch (behaviorName) {
            case 'selectSearchTerm': {
                const { searchTerms: searchTermsArray } = moduleConfig;
                this.searchTerm = modules_helper_1.ModulesHelper.Helpers.getRandomElement(searchTermsArray) || null;
                if (!this.searchTerm) {
                    throw this._createError('Could not select a search term from the provided list.', 'VALIDATION_ERROR');
                }
                this._logInfo(`Selected search term: '${this.searchTerm}'`);
                success = true;
                break;
            }
            case 'navigateToGoogle':
                this._logInfo(`Navigating to Google homepage: ${this.GOOGLE_SEARCH.BASE_URL}`);
                await this.nav.navigate(page, this.GOOGLE_SEARCH.BASE_URL, { ...options, timeout: this.config.navigationTimeout });
                success = true;
                break;
            case 'handleCookieConsent':
                await this._handleCookieConsent(page);
                success = true; // Assume success as it's a non-critical, best-effort operation
                break;
            case 'preSearchWait':
                this._logInfo('Waiting for a random duration (4-6 seconds) before starting search...');
                await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(4000, 6000));
                success = true;
                break;
            case 'preSearchMouseMove':
                this._logInfo('Performing mouse move behavior.');
                success = await modules_helper_1.ModulesHelper.Helpers.mouseMove(page, {
                    steps: { min: 25, max: 40 },
                    delay: { min: 10, max: 20 },
                });
                break;
            case 'typeSearchTerm': {
                if (!this.searchTerm) {
                    throw new Error('Search term not selected.');
                }
                this._logInfo(`--- Starting typeSearchTerm behavior for '${this.searchTerm}' ---`);
                this._logInfo('Attempting to click the search input.');
                const clickSuccess = await this.interactionService.handleElementInteraction(page, {
                    selectors: [this.GOOGLE_SEARCH.SEARCH_INPUT_SELECTOR],
                    actions: ['hover', 'wait', 'click'],
                    maxRetries: 3,
                    interactionOptions: {
                        scroll: { delay: { min: 70, max: 120 } },
                        hover: { delay: { min: 800, max: 1200 } },
                        click: { delay: { min: 150, max: 300 } },
                    },
                });
                if (!clickSuccess) {
                    throw this._createError('Failed to click on the search input.', 'INTERACTION_FAILED');
                }
                await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(1500, 2000)); // Wait for any pop-ups to appear
                const activeElementInfo = await page.evaluate(() => {
                    const el = document.activeElement;
                    return el ? {
                        tagName: el.tagName,
                        id: el.id,
                        className: el.className,
                        name: el.getAttribute('name'),
                        type: el.getAttribute('type'),
                    } : null;
                });
                this._logInfo('Active element details after click:', { activeElementInfo });
                const typeSuccess = await this.interactionService.handleElementInteraction(page, {
                    selectors: [this.GOOGLE_SEARCH.SEARCH_INPUT_SELECTOR],
                    actions: ['type', 'wait', 'enter'],
                    typeText: this.searchTerm,
                    expectsNavigation: true,
                    maxRetries: 1, // We assume the element is already focused
                    interactionOptions: {
                        type: { delay: { min: 80, max: 160 }, typos: { min: 0, max: 2 } },
                    },
                });
                if (!typeSuccess) {
                    throw this._createError('Failed to type or submit the search term.', 'INTERACTION_FAILED');
                }
                await this.nav.assertNavigationState(page, {
                    urlShouldMatch: /google\.com\/search/,
                    bodyShouldContain: [this.GOOGLE_SEARCH.RESULTS_CONTAINER_SELECTOR],
                });
                this._logInfo('Successfully navigated to search results page and asserted state.');
                this._logInfo('--- Finished typeSearchTerm behavior ---');
                success = true;
                break;
            }
            case 'postSearchWait':
                this._logInfo('Waiting for a random duration (2-4 seconds) after search...');
                await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(2000, 4000));
                success = true;
                break;
            case 'findAndClickTarget': {
                if (!targetURL) {
                    this._logDebug('No targetURL provided, skipping find and click behavior.');
                    success = true; // Skipped behavior is considered a success in this context.
                    return;
                }
                const maxPagesToSearch = modules_helper_1.ModulesHelper.Helpers.randomBetween(3, 5);
                let targetFound = false;
                for (let i = 1; i <= maxPagesToSearch; i++) {
                    this._logInfo(`Scanning page ${i} for target URL: ${targetURL}`);
                    await modules_helper_1.ModulesHelper.Helpers.scrollPage(page, { direction: 'down', amount: { min: 400, max: 800 } });
                    await modules_helper_1.ModulesHelper.Helpers.mouseMove(page, { steps: { min: 5, max: 15 } }); // Unstuck mouse
                    // Handle potential location permission prompt that may appear after scroll
                    this._logInfo('Checking for location permission prompt (waiting 4-6s)...');
                    await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(4000, 6000));
                    try {
                        const selector = this.GOOGLE_SEARCH.LOCATION_PROMPT_SELECTOR;
                        if (await page.isVisible(selector)) {
                            this._logInfo('Location prompt visible. Clicking...');
                            await this.interactionService.handleElementInteraction(page, {
                                selectors: [selector],
                                actions: ['hover', 'wait', 'click'],
                                maxRetries: 1,
                                interactionOptions: { click: { delay: { min: 50, max: 150 } } },
                            });
                            await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(500, 1000)); // Wait for UI update
                        }
                    }
                    catch (error) {
                        this._logWarn('Error handling location prompt during scan:', { error: error.message });
                    }
                    await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(500, 1500));
                    await modules_helper_1.ModulesHelper.Helpers.scrollPage(page, { direction: 'up', amount: { min: 200, max: 400 } });
                    await modules_helper_1.ModulesHelper.Helpers.mouseMove(page, { steps: { min: 5, max: 15 } }); // Unstuck mouse
                    this._logDebug(`Attempting to find and interact with target URL on page ${i}.`);
                    targetFound = await this.interactionService.handleElementInteraction(page, {
                        // Target the h3 title within standard search results (#rso .MjjYud) to avoid ads/related searches
                        selectors: ['#rso .MjjYud a[href] h3'],
                        actions: ['hover', 'wait', 'click'],
                        expectsNavigation: true,
                        navigationVerification: {
                            expectedUrl: targetURL,
                            timeout: this.nav.pageLoadTimeout,
                        },
                        filter: async (element) => {
                            // The interaction targets h3, but the URL is on the parent <a> tag.
                            // This evaluation is now protected by a strict timeout in InteractionService to prevent hanging.
                            const href = await element.evaluate((el) => {
                                const parentLink = el.closest('a');
                                return parentLink ? parentLink.getAttribute('href') : null;
                            });
                            if (!href || href.includes('google.com/search')) {
                                return false;
                            }
                            return modules_helper_1.ModulesHelper.Helpers.isSameDomain(href, targetURL);
                        },
                        maxRetries: 5,
                        interactionOptions: {
                            // Slightly faster scroll to reduce wait times on long pages
                            scroll: { delay: { min: 40, max: 80 } },
                            hover: { delay: { min: 600, max: 1000 } },
                            click: { delay: { min: 80, max: 200 } },
                        },
                    });
                    if (targetFound) {
                        this._logInfo('Target link clicked. Asserting final navigation state.');
                        await this.nav.assertNavigationState(page, {
                            hostnameShouldMatch: new URL(targetURL).hostname,
                            urlMustNotContain: ['google.com', 'captcha', 'error'],
                        });
                        this._logInfo('Final navigation state asserted successfully after clicking target.');
                        break;
                    }
                    if (i < maxPagesToSearch) {
                        this._logInfo('Target not found, attempting to navigate to the next page.');
                        const nextPageButton = page.locator(this.GOOGLE_SEARCH.NEXT_PAGE_BUTTON_SELECTOR);
                        if (await nextPageButton.isVisible()) {
                            await this.nav.navigateAfterAction(page, () => nextPageButton.click(), options);
                            await this._handleCookieConsent(page);
                        }
                        else {
                            this._logWarn('Next page button not found. Stopping search.');
                            break;
                        }
                    }
                }
                success = targetFound;
                if (!targetFound) {
                    throw this._createError(`Target URL "${targetURL}" not found within the first ${maxPagesToSearch} pages.`, 'TARGET_NOT_FOUND');
                }
                break;
            }
            case 'extractResults':
                if (!targetURL && moduleConfig.waitForResults !== false) {
                    this._logInfo('No target URL provided. Extracting search results data.');
                    this.searchResults = await this._extractSearchResults(page);
                }
                success = true; // This is a data extraction step, considered successful if it runs.
                break;
            default:
                this._logWarn(`Unknown navigator behavior: ${behaviorName}`);
                break;
        }
        if (!success) {
            this._logDebug(`ModulesHelper.Behavior '${behaviorName}' did not execute successfully or was skipped.`);
        }
    }
    async _handleCookieConsent(page) {
        try {
            this._logDebug('Checking for cookie consent pop-up visibility.');
            // Use isVisible to ensure the element is actually rendered and visible to the user
            const isVisible = await page.isVisible(this.GOOGLE_SEARCH.COOKIE_ACCEPT_SELECTOR);
            if (isVisible) {
                this._logInfo('Cookie consent pop-up is visible, clicking accept button.');
                await this.interactionService.handleElementInteraction(page, {
                    selectors: [this.GOOGLE_SEARCH.COOKIE_ACCEPT_SELECTOR],
                    actions: ['hover', 'wait', 'click'],
                    maxRetries: 1,
                    interactionOptions: {
                        click: { delay: { min: 10, max: 30 } },
                    },
                });
                await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(450, 600)); // Wait a bit for the banner to disappear
            }
            else {
                this._logDebug('No visible cookie consent pop-up found.');
            }
        }
        catch (error) {
            this._logWarn('Could not handle cookie consent pop-up, continuing operation.', { error });
        }
    }
    async _extractSearchResults(page) {
        try {
            // Wait for the main container to ensure results are present
            await page.waitForSelector(this.GOOGLE_SEARCH.RESULTS_CONTAINER_SELECTOR, { timeout: this.nav.elementWaitTimeout });
            const resultItems = await page.locator(this.GOOGLE_SEARCH.RESULT_ITEM_SELECTOR).all();
            const resultsWithPosition = [];
            for (let i = 0; i < resultItems.length; i++) {
                const item = resultItems[i];
                const title = await item.locator('h3').innerText().catch(() => '');
                const url = await item.locator('a').first().getAttribute('href').catch(() => '');
                const snippet = await item.locator('.VwiC3b, .s3v9rd').innerText().catch(() => '');
                if (url) { // Only add results that have a URL
                    resultsWithPosition.push({
                        position: i + 1,
                        title,
                        url,
                        snippet,
                    });
                }
            }
            this._logDebug('Extracted search results using manual iteration', { count: resultsWithPosition.length });
            return resultsWithPosition;
        }
        catch (error) {
            this._logWarn('Failed to extract search results.', { error: error.message });
            return [];
        }
    }
}
exports.default = GoogleSearchNavigator;
//# sourceMappingURL=google-search-navigator.js.map
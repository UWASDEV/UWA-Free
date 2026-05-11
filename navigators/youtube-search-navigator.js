"use strict";
/**
 * @description Handles YouTube search by simulating human-like interaction on the YouTube homepage.
 * @author UWAS.DEV
 * @date 2026-05-11
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
const modules_helper_1 = require("../modules-helper");
class YouTubeSearchNavigator extends modules_helper_1.ModulesHelper.BaseNavigator {
    YOUTUBE_SEARCH = {
        BASE_URL: 'https://www.youtube.com',
        SEARCH_INPUT_SELECTOR: '#center > yt-searchbox > div.ytSearchboxComponentInputContainer > div > form > input',
        RESULTS_URL_PATTERN: /youtube\.com\/results/,
        RESULTS_ITEM_LINK_SELECTORS: [
            'a#video-title',
            'a.yt-simple-endpoint.style-scope.ytd-video-renderer',
            'a.yt-simple-endpoint.style-scope.ytd-channel-renderer',
            'a.yt-simple-endpoint.style-scope.ytd-playlist-renderer',
            'a.yt-simple-endpoint.style-scope.ytd-grid-video-renderer',
        ],
        RESULTS_CONTAINER_SELECTORS: [
            'ytd-search',
            'ytd-two-column-search-results-renderer',
            '#contents.ytd-section-list-renderer',
        ],
    };
    searchTermsPattern = /^[a-zA-Z0-9\s\-_.,:;!?'"()&%#@*+=[\]{}<>|\\^~`\u00E7\u00C7\u011F\u011E\u0131\u0130\u00F6\u00D6\u015F\u015E\u00FC\u00DC\u0103\u0102\u00E2\u00C2\u00EE\u00CE\u0219\u0218\u021B\u021A\u0163\u0162]+$/;
    urlPattern = /^(https?):\/\/[^\s/$.?#].[^\s]*$/i;
    searchTerm = null;
    searchResults = [];
    static getMetadata() {
        return {
            id: 'youtube_search_navigator',
            title: 'YouTube Search',
            description: 'Performs a human-like YouTube search and clicks the matching target URL from the results page.',
            category: 'search',
            enabled: true,
            order: 25,
            version: '1.0.0',
        };
    }
    getNavigatorType() {
        return YouTubeSearchNavigator.getMetadata().id;
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
                    description: 'The terms to search for on YouTube.',
                },
                targetURL: {
                    type: 'string',
                    format: 'uri',
                    description: 'The target YouTube result URL to click when found.',
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
        const { searchTerms, targetURL } = config;
        if (!Array.isArray(searchTerms) || searchTerms.length === 0) {
            throw this._createValidationError('searchTerms', searchTerms, 'format', 'searchTerms must be a non-empty array of strings.');
        }
        for (const term of searchTerms) {
            if (typeof term !== 'string' || !this.searchTermsPattern.test(term)) {
                throw this._createValidationError('searchTerms', term, 'format', `Search term '${term}' contains invalid characters.`);
            }
        }
        if (targetURL && (typeof targetURL !== 'string' || !this.urlPattern.test(targetURL))) {
            throw this._createValidationError('targetURL', targetURL, 'format', 'targetURL must be a valid URL when provided.');
        }
        this._logInfo('YouTubeSearchNavigator configuration validated successfully.');
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
                loopType: 'youtube_search_flow',
                executionMode: 'sequential',
            });
            const { targetURL } = moduleConfig;
            if (targetURL) {
                this._logInfo('Asserting final state against the target URL.', { targetURL });
                await this.nav.assertNavigationState(page, {
                    customValidation: currentPage => Promise.resolve(this._matchesTargetUrl(currentPage.url(), targetURL)),
                    urlMustNotContain: ['youtube.com/results', 'captcha', 'error'],
                });
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
            this._logInfo('YouTube search navigation completed and state asserted successfully', {
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
            this._logError('YouTube search execution failed', { error: error.message, duration });
            throw await this._handleNavigationError(error, {
                operation: 'youtube_search',
                searchTerms: moduleConfig.searchTerms,
                duration,
            });
        }
    }
    _selectNavigatorPageBehaviors() {
        return [
            { name: 'selectSearchTerm', optional: false },
            { name: 'navigateToYouTube', optional: false },
            { name: 'preSearchMouseMove', optional: true },
            { name: 'clickSearchInput', optional: false },
            { name: 'typeSearchTerm', optional: false },
            { name: 'postResultsMouseMove', optional: true },
            { name: 'postResultsScroll', optional: true },
            { name: 'findAndClickTarget', optional: false },
            { name: 'extractResults', optional: false },
        ];
    }
    async _executeNavigatorPageBehavior(behaviorName, page, options) {
        const { navigator: moduleConfig } = options.config;
        const { targetURL } = moduleConfig;
        let success = false;
        switch (behaviorName) {
            case 'selectSearchTerm': {
                const { searchTerms } = moduleConfig;
                this.searchTerm = modules_helper_1.ModulesHelper.Helpers.getRandomElement(searchTerms) || null;
                if (!this.searchTerm) {
                    throw this._createError('Could not select a search term from the provided list.', 'VALIDATION_ERROR');
                }
                this._logInfo(`Selected search term: '${this.searchTerm}'`);
                success = true;
                break;
            }
            case 'navigateToYouTube':
                this._logInfo(`Navigating to YouTube homepage: ${this.YOUTUBE_SEARCH.BASE_URL}`);
                await this.nav.navigate(page, this.YOUTUBE_SEARCH.BASE_URL, { ...options, timeout: this.config.navigationTimeout });
                success = true;
                break;
            case 'preSearchMouseMove':
                this._logInfo('Performing random mouse movement before search interaction.');
                success = await modules_helper_1.ModulesHelper.Helpers.mouseMove(page, {
                    steps: { min: 20, max: 40 },
                    delay: { min: 10, max: 20 },
                    pauseChance: 0.25,
                    pauseDuration: { min: 120, max: 350 },
                });
                break;
            case 'clickSearchInput':
                this._logInfo('Clicking the YouTube search input.');
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: [this.YOUTUBE_SEARCH.SEARCH_INPUT_SELECTOR],
                    actions: ['hover', 'wait', 'click'],
                    maxRetries: 3,
                    interactionOptions: {
                        scroll: { delay: { min: 60, max: 100 } },
                        hover: { delay: { min: 500, max: 900 } },
                        click: { delay: { min: 120, max: 220 } },
                    },
                });
                if (!success) {
                    throw this._createError('Failed to click on the YouTube search input.', 'INTERACTION_FAILED');
                }
                await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(400, 900));
                break;
            case 'typeSearchTerm':
                if (!this.searchTerm) {
                    throw this._createError('Search term not selected.', 'VALIDATION_ERROR');
                }
                this._logInfo(`Typing search term with human-like typos and submitting with Enter: '${this.searchTerm}'`);
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: [this.YOUTUBE_SEARCH.SEARCH_INPUT_SELECTOR],
                    actions: ['type', 'wait', 'enter'],
                    typeText: this.searchTerm,
                    expectsNavigation: true,
                    maxRetries: 1,
                    interactionOptions: {
                        type: { delay: { min: 80, max: 160 }, typos: { min: 0, max: 2 } },
                    },
                });
                if (!success) {
                    throw this._createError('Failed to type and submit the YouTube search term.', 'INTERACTION_FAILED');
                }
                await this.nav.assertNavigationState(page, {
                    urlShouldMatch: this.YOUTUBE_SEARCH.RESULTS_URL_PATTERN,
                    bodyShouldContain: [...this.YOUTUBE_SEARCH.RESULTS_CONTAINER_SELECTORS],
                });
                break;
            case 'postResultsMouseMove':
                this._logInfo('Performing random mouse movement on the results page.');
                success = await modules_helper_1.ModulesHelper.Helpers.mouseMove(page, {
                    steps: { min: 10, max: 24 },
                    delay: { min: 8, max: 20 },
                    pauseChance: 0.2,
                    pauseDuration: { min: 80, max: 240 },
                });
                break;
            case 'postResultsScroll':
                this._logInfo('Performing an initial random scroll on the results page.');
                await this._performHumanizedResultsScanStep(page, 0);
                success = true;
                break;
            case 'findAndClickTarget':
                if (!targetURL) {
                    this._logDebug('No targetURL provided, skipping target click behavior.');
                    success = true;
                    break;
                }
                success = await this._findAndClickTarget(page, targetURL);
                if (!success) {
                    throw this._createError(`Target URL "${targetURL}" was not found on the YouTube results page.`, 'TARGET_NOT_FOUND');
                }
                break;
            case 'extractResults':
                if (!targetURL && moduleConfig.waitForResults !== false) {
                    this._logInfo('No target URL provided. Extracting YouTube search results data.');
                    this.searchResults = await this._extractSearchResults(page);
                }
                success = true;
                break;
            default:
                this._logWarn(`Unknown navigator behavior: ${behaviorName}`);
                break;
        }
        if (!success) {
            this._logDebug(`Behavior '${behaviorName}' did not execute successfully or was skipped.`);
        }
    }
    async _findAndClickTarget(page, targetURL) {
        const maxScanAttempts = 30;
        let stableBottomHits = 0;
        let previousScrollHeight = 0;
        for (let attempt = 0; attempt < maxScanAttempts; attempt += 1) {
            this._logInfo(`Scanning YouTube results for target URL. Attempt ${attempt + 1}/${maxScanAttempts}.`, { targetURL });
            const targetFound = await this.interactionService.handleElementInteraction(page, {
                selectors: this.YOUTUBE_SEARCH.RESULTS_ITEM_LINK_SELECTORS,
                actions: ['hover', 'wait', 'click'],
                expectsNavigation: true,
                navigationVerification: {
                    expectedUrl: targetURL,
                    timeout: this.nav.pageLoadTimeout,
                },
                filter: async (element) => {
                    const href = await element.evaluate((node) => node.getAttribute('href'));
                    return this._matchesTargetUrl(href, targetURL);
                },
                maxRetries: 1,
                interactionOptions: {
                    scroll: { delay: { min: 50, max: 90 } },
                    hover: { delay: { min: 450, max: 850 } },
                    click: { delay: { min: 90, max: 170 } },
                },
            });
            if (targetFound) {
                this._logInfo('Target YouTube result clicked successfully. Asserting final page state.');
                await this.nav.assertNavigationState(page, {
                    customValidation: currentPage => Promise.resolve(this._matchesTargetUrl(currentPage.url(), targetURL)),
                    urlMustNotContain: ['youtube.com/results', 'captcha', 'error'],
                });
                return true;
            }
            const scrollState = await this._performHumanizedResultsScanStep(page, attempt + 1);
            if (scrollState.scrollHeight <= previousScrollHeight) {
                stableBottomHits += 1;
            }
            else {
                stableBottomHits = 0;
                previousScrollHeight = scrollState.scrollHeight;
            }
            if (scrollState.isNearBottom && stableBottomHits >= 3) {
                this._logWarn('Reached the end of the currently loaded YouTube results without finding the target URL.', {
                    targetURL,
                    attempt: attempt + 1,
                });
                break;
            }
            await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(500, 1400));
        }
        return false;
    }
    async _performHumanizedResultsScanStep(page, attemptIndex) {
        await modules_helper_1.ModulesHelper.Helpers.mouseMove(page, {
            steps: { min: 5, max: 14 },
            delay: { min: 8, max: 18 },
            pauseChance: 0.15,
            pauseDuration: { min: 60, max: 180 },
        });
        if (attemptIndex > 0 && attemptIndex % 4 === 0) {
            await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(900, 1800));
        }
        else {
            await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(250, 800));
        }
        await modules_helper_1.ModulesHelper.Helpers.scrollPage(page, {
            direction: 'down',
            amount: { min: 500, max: 1300 },
            steps: { min: 6, max: 16 },
            delay: { min: 20, max: 55 },
            pauseChance: 0.2,
            pauseDuration: { min: 120, max: 320 },
        });
        const shouldScrollUp = attemptIndex > 0 && (attemptIndex % 3 === 0 || Math.random() < 0.35);
        if (shouldScrollUp) {
            await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(200, 650));
            await modules_helper_1.ModulesHelper.Helpers.scrollPage(page, {
                direction: 'up',
                amount: { min: 120, max: 320 },
                steps: { min: 3, max: 8 },
                delay: { min: 18, max: 40 },
            });
        }
        return page.evaluate(() => {
            const scrollingElement = document.scrollingElement || document.documentElement || document.body;
            const { scrollTop, scrollHeight } = scrollingElement;
            const viewportHeight = window.innerHeight;
            return {
                scrollHeight,
                isNearBottom: scrollTop + viewportHeight >= scrollHeight - 300,
            };
        });
    }
    async _extractSearchResults(page) {
        try {
            const selectors = this.YOUTUBE_SEARCH.RESULTS_CONTAINER_SELECTORS;
            let containerFound = false;
            for (const selector of selectors) {
                try {
                    await page.waitForSelector(selector, { timeout: this.nav.elementWaitTimeout });
                    containerFound = true;
                    break;
                }
                catch {
                    continue;
                }
            }
            if (!containerFound) {
                this._logWarn('Could not find a YouTube results container for extraction.');
                return [];
            }
            const selector = this.YOUTUBE_SEARCH.RESULTS_ITEM_LINK_SELECTORS[0];
            const resultItems = await page.locator(selector).all();
            const resultsWithPosition = [];
            for (let i = 0; i < resultItems.length; i += 1) {
                const item = resultItems[i];
                const title = (await item.textContent())?.trim() || '';
                const url = await item.getAttribute('href');
                const absoluteUrl = this._toAbsoluteUrl(url);
                if (!absoluteUrl || !title) {
                    continue;
                }
                resultsWithPosition.push({
                    position: i + 1,
                    title,
                    url: absoluteUrl,
                });
            }
            this._logDebug('Extracted YouTube search results using manual iteration', { count: resultsWithPosition.length });
            return resultsWithPosition;
        }
        catch (error) {
            this._logWarn('Failed to extract YouTube search results.', { error: error.message });
            return [];
        }
    }
    _matchesTargetUrl(candidateUrl, targetURL) {
        const normalizedCandidate = this._normalizeYouTubeUrl(candidateUrl);
        const normalizedTarget = this._normalizeYouTubeUrl(targetURL);
        if (!normalizedCandidate || !normalizedTarget) {
            return false;
        }
        if (normalizedCandidate === normalizedTarget) {
            return true;
        }
        return normalizedCandidate.includes(normalizedTarget) || normalizedTarget.includes(normalizedCandidate);
    }
    _normalizeYouTubeUrl(urlValue) {
        if (!urlValue || typeof urlValue !== 'string') {
            return null;
        }
        try {
            const absoluteUrl = this._toAbsoluteUrl(urlValue);
            if (!absoluteUrl) {
                return null;
            }
            const parsedUrl = new URL(absoluteUrl);
            const hostname = parsedUrl.hostname.replace(/^www\./, '');
            if (hostname === 'youtu.be') {
                return `youtu.be${parsedUrl.pathname.replace(/\/$/, '')}`;
            }
            if (hostname.endsWith('youtube.com') && parsedUrl.pathname === '/watch') {
                const videoId = parsedUrl.searchParams.get('v');
                if (videoId) {
                    return `youtube.com/watch?v=${videoId}`;
                }
            }
            return `${hostname}${parsedUrl.pathname.replace(/\/$/, '')}`;
        }
        catch {
            return null;
        }
    }
    _toAbsoluteUrl(urlValue) {
        if (!urlValue || typeof urlValue !== 'string') {
            return null;
        }
        if (/^https?:\/\//i.test(urlValue)) {
            return urlValue;
        }
        if (urlValue.startsWith('//')) {
            return `https:${urlValue}`;
        }
        if (urlValue.startsWith('/')) {
            return `https://www.youtube.com${urlValue}`;
        }
        return null;
    }
}
exports.default = YouTubeSearchNavigator;
//# sourceMappingURL=youtube-search-navigator.js.map
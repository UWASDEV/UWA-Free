"use strict";
/**
 * @description Handles direct URL navigation, updated for standardization.
 * @author UWAS.DEV
 * @date 2025-09-24
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
const modules_helper_1 = require("../modules-helper");
class DirectNavigator extends modules_helper_1.ModulesHelper.BaseNavigator {
    urlPattern = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
    static getMetadata() {
        return {
            id: 'direct_navigator',
            title: 'Direct URL',
            description: 'Navigator for direct URL navigation.',
            category: 'navigation',
            enabled: true,
            order: 10,
            version: '3.2.0',
        };
    }
    getNavigatorType() {
        return DirectNavigator.getMetadata().id;
    }
    getConfigSchema() {
        return {
            type: 'object',
            properties: {
                targetURL: {
                    type: 'string',
                    format: 'uri',
                    description: 'The direct URL to navigate to.',
                },
            },
            required: ['targetURL'],
            additionalProperties: false,
        };
    }
    validate(config) {
        const { targetURL } = config;
        if (typeof targetURL !== 'string' || !this.urlPattern.test(targetURL)) {
            throw this._createValidationError('targetURL', targetURL, 'format', 'targetURL must be a valid URL.');
        }
        this._logInfo('DirectNavigator configuration validated successfully.');
        return Promise.resolve();
    }
    async _run(page, options) {
        const startTime = modules_helper_1.ModulesHelper.Helpers.getTimestamp();
        const moduleConfig = options.config.navigator;
        const { targetURL } = moduleConfig;
        try {
            if (!targetURL || typeof targetURL !== 'string') {
                throw this._createValidationError('targetURL', targetURL, 'required_string', 'A valid targetURL is required for direct target navigation.');
            }
            await this.validate(moduleConfig);
            const url = targetURL.trim();
            this._logInfo('Starting direct URL navigation', { url });
            const navigationOptions = {
                timeout: typeof options.timeout === 'number' ? options.timeout : this.config.navigationTimeout,
            };
            const response = await this.nav.navigate(page, url, { ...options, ...navigationOptions });
            // Assert the final state
            const expectedState = {
                urlMustNotContain: ['captcha', 'login', 'error'],
                bodyShouldContain: ['body'],
            };
            if (url) {
                expectedState.hostnameShouldMatch = new URL(url).hostname;
            }
            await this.nav.assertNavigationState(page, expectedState);
            const endTime = modules_helper_1.ModulesHelper.Helpers.getTimestamp();
            const duration = modules_helper_1.ModulesHelper.Helpers.getTimeDifference(startTime, endTime);
            const result = {
                success: true,
                data: {
                    navigatorType: this.getNavigatorType(),
                    url: page.url(),
                    originalURL: url,
                    status: response.status(),
                    statusText: response.statusText(),
                    duration,
                    timestamp: endTime,
                    navigationOptions,
                },
            };
            this._logInfo('Direct URL navigation completed and state asserted successfully', {
                url: result.data?.url,
                status: result.data?.status,
                duration: `${duration}ms`,
            });
            return result;
        }
        catch (error) {
            const endTime = modules_helper_1.ModulesHelper.Helpers.getTimestamp();
            const duration = modules_helper_1.ModulesHelper.Helpers.getTimeDifference(startTime, endTime);
            this._logError('Direct URL navigation failed', { error: error.message, duration });
            throw await this._handleNavigationError(error, {
                operation: 'direct_navigation',
                targetURL: targetURL,
                duration,
            });
        }
    }
    // --- ModulesHelper.Behavior-based methods (empty for this navigator) ---
    _selectNavigatorPageBehaviors() {
        // This navigator performs no interactive behaviors, so it returns an empty array.
        return [];
    }
    _executeNavigatorPageBehavior(behaviorName) {
        // This navigator has no behaviors to execute.
        this._logWarn(`_executeNavigatorPageBehavior called for DirectNavigator with unexpected behavior: ${behaviorName}`);
        return Promise.resolve();
    }
}
exports.default = DirectNavigator;
//# sourceMappingURL=direct-navigator.js.map
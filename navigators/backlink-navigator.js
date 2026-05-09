"use strict";
/**
 * @description Navigates to a source page, finds a link, and clicks it. Updated for standardization.
 * @author UWAS.DEV
 * @date 2025-09-24
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
const modules_helper_1 = require("../modules-helper");
class BacklinkNavigator extends modules_helper_1.ModulesHelper.BaseNavigator {
    static getMetadata() {
        return {
            id: 'backlink_navigator',
            title: 'Backlink Navigation',
            description: 'Navigates to a source page first, then finds and clicks the link to the main Navigator URL.',
            category: 'backlink',
            enabled: true,
            order: 40,
            version: '4.2.0',
        };
    }
    getNavigatorType() {
        return BacklinkNavigator.getMetadata().id;
    }
    getConfigSchema() {
        return {
            type: 'object',
            properties: {
                sourceUrl: {
                    type: 'string',
                    format: 'uri',
                    description: 'The source URL where the link is located.',
                },
                targetURL: {
                    type: 'string',
                    format: 'uri',
                    description: 'The destination URL to find and click on the source page.',
                },
            },
            required: ['sourceUrl', 'targetURL'],
            additionalProperties: false,
        };
    }
    validate(config) {
        if (typeof config.sourceUrl !== 'string' || !/^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(config.sourceUrl)) {
            throw this._createValidationError('sourceUrl', config.sourceUrl, 'format', 'sourceUrl must be a valid URL.');
        }
        if (typeof config.targetURL !== 'string' || !/^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(config.targetURL)) {
            throw this._createValidationError('targetURL', config.targetURL, 'format', 'targetURL must be a valid URL.');
        }
        this._logInfo('BacklinkNavigator configuration validated successfully.');
        return Promise.resolve();
    }
    async _run(page, options) {
        const moduleConfig = options.config.navigator;
        await this.validate(moduleConfig);
        // Navigate to the source URL first as a prerequisite.
        const { sourceUrl } = moduleConfig;
        this._logInfo(`Navigating to source URL: ${sourceUrl}`);
        await this.nav.navigate(page, sourceUrl, { ...options, timeout: this.config.navigationTimeout });
        this._logInfo('Successfully navigated to source URL. Now executing behaviors.');
        const { completedBehaviors } = await this.interactionService.executeBehaviorLoop({
            page,
            options,
            behaviorSelector: this._selectNavigatorPageBehaviors.bind(this),
            behaviorExecutor: this._executeNavigatorPageBehavior.bind(this),
            loopType: 'backlink_flow',
            executionMode: 'sequential',
        });
        // Final state assertion: Ensure the module's main contract is met.
        const { targetURL } = moduleConfig;
        const finalExpectedState = {
            urlMustNotContain: ['captcha', 'login', 'error'],
        };
        if (targetURL) {
            finalExpectedState.hostnameShouldMatch = new URL(targetURL).hostname;
        }
        await this.nav.assertNavigationState(page, finalExpectedState);
        const finalUrl = page.url();
        this._logInfo(`Backlink navigation completed and state asserted successfully after ${completedBehaviors} behaviors. Final URL: ${finalUrl}`);
        return {
            success: true,
            data: {
                url: finalUrl,
                title: await page.title(),
            },
        };
    }
    _selectNavigatorPageBehaviors() {
        return [
            { name: 'preClickScroll', optional: true },
            { name: 'preClickRandomWait', optional: true },
            { name: 'preClickMouseMove', optional: true },
            { name: 'findAndClickBacklink', optional: false },
        ];
    }
    async _executeNavigatorPageBehavior(behaviorName, page, options) {
        const moduleConfig = options.config.navigator;
        const { sourceUrl, targetURL } = moduleConfig;
        let success = false;
        switch (behaviorName) {
            case 'preClickScroll':
                this._logInfo('Performing random scroll before searching for the link.');
                success = await modules_helper_1.ModulesHelper.Helpers.scrollPage(page, { direction: 'random', amount: { min: 200, max: 400 } });
                await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(500, 1500));
                break;
            case 'preClickMouseMove':
                this._logInfo('Performing mouse move behavior.');
                success = await modules_helper_1.ModulesHelper.Helpers.mouseMove(page, {
                    steps: { min: 15, max: 30 },
                    delay: { min: 10, max: 20 },
                });
                break;
            case 'preClickRandomWait':
                this._logInfo('Performing random wait behavior.');
                await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(2000, 4000));
                success = true;
                break;
            case 'findAndClickBacklink': {
                this._logInfo(`Searching for a link with the same domain as: "${targetURL}"`);
                const clicked = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['a[href]'],
                    actions: ['hover', 'wait', 'click'],
                    expectsNavigation: true, // Let the interaction service handle the navigation wait
                    filter: async (el) => {
                        const href = await el.getAttribute('href');
                        return href ? modules_helper_1.ModulesHelper.Helpers.isSameDomain(href, targetURL) : false;
                    },
                    maxRetries: 3,
                    interactionOptions: {
                        scroll: { delay: { min: 70, max: 120 } },
                        hover: { delay: { min: 200, max: 500 } },
                        click: { delay: { min: 50, max: 150 } },
                    },
                });
                success = clicked;
                if (!clicked) {
                    throw this._createError(`Link with the same domain as "${targetURL}" not found on page, or failed to click.`, String(modules_helper_1.ModulesHelper.ERROR_CODES.ELEMENT_NOT_FOUND.code), { sourceUrl, targetURL });
                }
                break;
            }
            default:
                this._logWarn(`Unknown navigator behavior: ${behaviorName}`);
                break;
        }
        if (!success) {
            this._logDebug(`ModulesHelper.Behavior '${behaviorName}' did not execute successfully or was skipped.`);
        }
    }
}
exports.default = BacklinkNavigator;
//# sourceMappingURL=backlink-navigator.js.map
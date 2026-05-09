"use strict";
/**
 * @description Implements a comprehensive surfing mission with an expanded behavior pool and improved loop logic.
 * @author UWAS.DEV
 * @date 2025-10-15
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
const modules_helper_1 = require("../modules-helper");
class SurfingMission extends modules_helper_1.ModulesHelper.BaseMission {
    static getMetadata() {
        return {
            id: 'surfing',
            title: 'Surfing',
            description: 'Comprehensive web browsing simulation with natural human behaviors',
            icon: '🌐',
            category: 'comprehensive',
            enabled: true,
            order: 20,
            version: '2.1.0',
        };
    }
    static getDefaultConfig() {
        return {
            ...super.getDefaultConfig(),
            mouseMovement: true,
            scrolling: true,
            randomClicks: true,
            additionalPages: true,
            socialMediaSimulation: true,
            explorationDepth: 3,
            linkClickProbability: 0.3,
            formInteractionProbability: 0.2,
        };
    }
    getConfigSchema() {
        // This mission uses a wide range of options from the base options.
        // No specific additional schema is needed here.
        return {};
    }
    validate(_config) {
        return Promise.resolve();
    }
    async _run(page, options) {
        this._logInfo('🌊 Starting Surfing mission on target page');
        if (!this.enabled) {
            this._logDebug('Surfing mission disabled, skipping target page execution');
            this.emitMissionCompleted(true, 'successful_completion', { reason: 'disabled' });
            return { success: true, reason: 'disabled' };
        }
        const startTime = Date.now();
        try {
            await this.nav.validateNavigationContext({ page });
            // Assert initial state before starting behaviors
            const expectedState = {
                urlMustNotContain: ['captcha', 'login', 'error'],
                bodyShouldContain: ['body'],
            };
            if (options.targetURL) {
                expectedState.hostnameShouldMatch = new URL(options.targetURL).hostname;
            }
            await this.nav.assertNavigationState(page, expectedState);
            this._logInfo('🌊 Initial navigation state asserted successfully.');
            this._logInfo('🌊 Surfing mission will perform a dynamic set of behaviors on the target page.');
            const { completedBehaviors } = await this.interactionService.executeBehaviorLoop({
                page,
                options,
                behaviorSelector: this._selectTargetPageBehaviors.bind(this),
                behaviorExecutor: this._executeTargetPageBehavior.bind(this),
                loopType: 'target_page',
                executionMode: 'random',
            });
            // Assert final state after behaviors are completed
            await this.nav.assertNavigationState(page, expectedState);
            this._logInfo('🌊 Final navigation state asserted successfully.');
            const totalTime = Date.now() - startTime;
            this._logInfo('✅ Surfing mission completed on target page', {
                totalTime,
                completedBehaviors,
                targetURL: options.targetURL,
            });
            this.emitMissionCompleted(true, 'successful_completion', {
                timeSpent: totalTime,
                completedBehaviors,
                // totalBehaviors: targetBehaviorCount, // This is now dynamic inside the loop
                targetURL: options.targetURL,
            });
            return {
                success: true,
                reason: 'successful_completion',
                data: {
                    duration: totalTime,
                    completedBehaviors,
                    targetURL: options.targetURL,
                },
            };
        }
        catch (error) {
            const enhancedError = await this.nav.handleNavigationError(error, {
                operation: 'surfing_target_page_execution',
                missionType: this.getModuleType(),
                targetURL: options.targetURL,
            });
            this._logError('❌ Surfing mission failed on target page', enhancedError);
            this.emitMissionCompleted(false, 'error', {
                error: enhancedError.message,
                targetURL: options.targetURL,
            });
            throw enhancedError;
        }
    }
    _selectTargetPageBehaviors() {
        const behaviors = [];
        // Core navigation behaviors are considered mandatory for a realistic session.
        if (this.config.scrolling) {
            behaviors.push({ name: 'scroll', optional: false });
        }
        if (this.config.mouseMovement) {
            behaviors.push({ name: 'mouseMove', optional: false });
        }
        // Interactive behaviors are optional to add variety.
        if (this.config.randomClicks) {
            behaviors.push({ name: 'randomWait', optional: true });
            behaviors.push({ name: 'textSelection', optional: true });
            behaviors.push({ name: 'randomWait', optional: true });
            behaviors.push({ name: 'imageHover', optional: true });
            behaviors.push({ name: 'textSelection', optional: true });
            behaviors.push({ name: 'randomWait', optional: true });
            behaviors.push({ name: 'linkClick', optional: true });
        }
        return behaviors;
    }
    async _executeTargetPageBehavior(behavior, page, _options) {
        this._logDebug(`Executing behavior: ${behavior}`);
        let success = false;
        switch (behavior) {
            case 'scroll':
                this._logInfo('Performing scroll behavior.');
                success = await modules_helper_1.ModulesHelper.Helpers.scrollPage(page, {
                    steps: { min: 25, max: 40 },
                    delay: { min: 30, max: 50 },
                    amount: { min: 300, max: 600 },
                    direction: 'random',
                });
                break;
            case 'mouseMove':
                this._logInfo('Performing mouse move behavior.');
                success = await modules_helper_1.ModulesHelper.Helpers.mouseMove(page, {
                    steps: { min: 25, max: 40 },
                    delay: { min: 10, max: 20 },
                });
                break;
            case 'textSelection':
                this._logInfo('Performing robust text selection behavior on a random element.');
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['p', 'h1', 'h2', 'h3', 'span', 'div'],
                    actions: ['hover', 'wait', 'select'],
                    clickCount: 3,
                    maxRetries: 3, // Try up to 3 random elements
                    interactionOptions: {
                        scroll: { delay: { min: 70, max: 120 } },
                        select: { delay: { min: 80, max: 120 } },
                    },
                });
                break;
            case 'linkClick':
                if (Math.random() < this.config.linkClickProbability) {
                    this._logInfo('Performing robust link click behavior on a random link.');
                    const pageUrl = page.url();
                    success = await this.interactionService.handleElementInteraction(page, {
                        selectors: ['a[href]'],
                        actions: ['hover', 'wait', 'click'],
                        expectsNavigation: true, // Let the interaction service handle the navigation wait
                        filter: async (el) => {
                            const href = await el.getAttribute('href');
                            return href ? modules_helper_1.ModulesHelper.Helpers.isSameDomain(href, pageUrl) : false;
                        },
                        maxRetries: 5,
                        interactionOptions: {
                            scroll: { delay: { min: 70, max: 120 } },
                            hover: { delay: { min: 400, max: 700 } },
                        },
                    });
                }
                break;
            case 'formFocus':
                if (Math.random() < this.config.formInteractionProbability) {
                    this._logInfo('Performing robust typing simulation into a random form element.');
                    success = await this.interactionService.handleElementInteraction(page, {
                        selectors: ['input[type="text"]', 'input[type="email"]', 'textarea'],
                        actions: ['hover', 'wait', 'click', 'wait', 'type'],
                        typeText: 'Simulating text input.',
                        maxRetries: 3,
                        interactionOptions: {
                            scroll: { delay: { min: 70, max: 120 } },
                            type: { delay: { min: 200, max: 300 }, typos: { min: 1, max: 3 } },
                        },
                    });
                }
                break;
            case 'imageHover':
                this._logInfo('Performing robust image hover behavior on a random image.');
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['img'],
                    actions: ['hover'],
                    maxRetries: 5,
                    interactionOptions: {
                        scroll: { delay: { min: 70, max: 120 } },
                        hover: { delay: { min: 400, max: 700 } },
                    },
                });
                break;
            case 'randomWait':
                this._logInfo('Performing random wait behavior.');
                await modules_helper_1.ModulesHelper.Helpers.randomDelay(1000, 3000);
                success = true;
                break;
            default:
                this._logWarn(`Unknown target page behavior selected: ${behavior}`);
        }
        if (!success) {
            this._logDebug(`ModulesHelper.Behavior '${behavior}' did not execute successfully or was skipped.`);
        }
    }
    shouldComplete(context) {
        if (context.behavior === 'link_exploration' && Math.random() < 0.3) {
            return true;
        }
        if (typeof context.behaviorIndex === 'number' && context.behaviorIndex >= 4) {
            return Math.random() < 0.5;
        }
        return false;
    }
    supportsAdditionalPages() {
        return this.config.additionalPages;
    }
    getExplorationDepth() {
        return this.config.explorationDepth;
    }
}
exports.default = SurfingMission;
//# sourceMappingURL=surfing.js.map
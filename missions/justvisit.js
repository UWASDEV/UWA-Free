"use strict";
/**
 * @description Implements a minimal visit-focused mission, updated for standardization.
 * @author UWAS.DEV
 * @date 2025-09-24
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
const modules_helper_1 = require("../modules-helper");
class JustVisitMission extends modules_helper_1.ModulesHelper.BaseMission {
    static getMetadata() {
        return {
            id: 'just_visit',
            title: 'Just Visit',
            description: 'Visit-focused minimal behavior with fast processing',
            icon: '🎯',
            category: 'minimal',
            enabled: true,
            order: 10,
            version: '2.1.0',
        };
    }
    static getDefaultConfig() {
        const baseConfig = super.getDefaultConfig();
        return {
            ...baseConfig,
            mouseMovement: true,
            scrolling: false,
            randomClicks: false,
            additionalPages: false,
            explorationDepth: 0,
            linkClickProbability: 0,
            formInteractionProbability: 0,
        };
    }
    getConfigSchema() {
        // This mission has no specific configuration.
        return {};
    }
    validate(_config) {
        return Promise.resolve();
    }
    async _run(page, options) {
        this._logInfo('🎯 Starting JustVisit mission on target page');
        if (!this.enabled) {
            this._logDebug('JustVisit mission disabled, skipping target page execution');
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
            this._logInfo('🎯 Initial navigation state asserted successfully.');
            this._logInfo('🎯 JustVisit mission will perform a minimal set of behaviors.');
            const { completedBehaviors } = await this.interactionService.executeBehaviorLoop({
                page,
                options,
                behaviorSelector: this._selectTargetPageBehaviors.bind(this),
                behaviorExecutor: this._executeTargetPageBehavior.bind(this),
                loopType: 'just_visit_minimal',
                executionMode: 'sequential',
            });
            // Assert final state after behaviors are completed
            const finalExpectedState = {
                urlMustNotContain: ['captcha', 'login', 'error'],
                bodyShouldContain: ['body'],
            };
            if (options.targetURL) {
                finalExpectedState.hostnameShouldMatch = new URL(options.targetURL).hostname;
            }
            await this.nav.assertNavigationState(page, finalExpectedState);
            this._logInfo('🎯 Final navigation state asserted successfully.');
            const totalTime = Date.now() - startTime;
            this._logInfo('✅ JustVisit mission completed on target page', {
                totalTime,
                completedBehaviors,
                targetURL: options.targetURL,
            });
            this.emitMissionCompleted(true, 'successful_completion', {
                timeSpent: totalTime,
                completedBehaviors,
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
                operation: 'justvisit_target_page_execution',
                missionType: this.getModuleType(),
                targetURL: options.targetURL,
            });
            this._logError('❌ JustVisit mission failed on target page', enhancedError);
            this.emitMissionCompleted(false, 'error', {
                error: enhancedError.message,
                targetURL: options.targetURL,
            });
            throw enhancedError;
        }
    }
    _selectTargetPageBehaviors() {
        const behaviors = [];
        // behaviors.push({ name: 'mouseMove', optional: false });
        behaviors.push({ name: 'randomWait', optional: false });
        return behaviors;
    }
    async _executeTargetPageBehavior(behavior, page, options) {
        this._logDebug(`Executing behavior: ${behavior}`);
        let success = false;
        switch (behavior) {
            case 'mouseMove':
                this._logInfo('Performing mouse move behavior.');
                success = await modules_helper_1.ModulesHelper.Helpers.mouseMove(page, {
                    steps: { min: 25, max: 40 },
                    delay: { min: 10, max: 20 },
                });
                break;
            case 'randomWait':
                this._logInfo('Performing random wait behavior.');
                // Use waitWithFeed to prevent watchdog timeout during this long wait
                await modules_helper_1.ModulesHelper.Helpers.waitWithFeed(modules_helper_1.ModulesHelper.Helpers.randomBetween(2000, 3000), options.watchdogFeed);
                success = true;
                break;
            default:
                this._logWarn(`Unknown target page behavior selected for JustVisit: ${behavior}`);
        }
        if (!success) {
            this._logDebug(`ModulesHelper.Behavior '${behavior}' did not execute successfully or was skipped.`);
        }
    }
    shouldComplete(_context) {
        return true;
    }
    supportsAdditionalPages() {
        return this.config.additionalPages || false;
    }
    getExplorationDepth() {
        return this.config.explorationDepth || 0;
    }
}
exports.default = JustVisitMission;
//# sourceMappingURL=justvisit.js.map
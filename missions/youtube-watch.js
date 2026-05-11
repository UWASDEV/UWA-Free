"use strict";
/**
 * @description Implements a YouTube watch mission that waits on the page while performing intermittent mouse movement.
 * @author UWAS.DEV
 * @date 2026-05-11
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
const modules_helper_1 = require("../modules-helper");
class YoutubeWatchMission extends modules_helper_1.ModulesHelper.BaseMission {
    WATCH_DURATION_MS = {
        min: 40000,
        max: 90000,
    };
    IDLE_SEGMENT_MS = {
        min: 1200,
        max: 4500,
    };
    static getMetadata() {
        return {
            id: 'youtube_watch',
            title: 'Youtube Watch',
            description: 'Waits on the target page like a viewer while occasionally moving the mouse without scrolling.',
            icon: '▶️',
            category: 'engagement',
            enabled: true,
            order: 30,
            version: '1.0.0',
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
        return {};
    }
    validate(_config) {
        return Promise.resolve();
    }
    async _run(page, options) {
        this._logInfo('▶️ Starting Youtube Watch mission on target page');
        if (!this.enabled) {
            this._logDebug('Youtube Watch mission disabled, skipping target page execution');
            this.emitMissionCompleted(true, 'successful_completion', { reason: 'disabled' });
            return { success: true, reason: 'disabled' };
        }
        const startTime = Date.now();
        try {
            await this.nav.validateNavigationContext({ page });
            const expectedState = {
                urlMustNotContain: ['captcha', 'login', 'error'],
                bodyShouldContain: ['body'],
            };
            if (options.targetURL) {
                expectedState.hostnameShouldMatch = new URL(options.targetURL).hostname;
            }
            await this.nav.assertNavigationState(page, expectedState);
            this._logInfo('▶️ Initial navigation state asserted successfully.');
            const { completedBehaviors } = await this.interactionService.executeBehaviorLoop({
                page,
                options,
                behaviorSelector: this._selectTargetPageBehaviors.bind(this),
                behaviorExecutor: this._executeTargetPageBehavior.bind(this),
                loopType: 'youtube_watch',
                executionMode: 'sequential',
            });
            await this.nav.assertNavigationState(page, expectedState);
            this._logInfo('▶️ Final navigation state asserted successfully.');
            const totalTime = Date.now() - startTime;
            const resultData = {
                duration: totalTime,
                completedBehaviors,
                targetURL: options.targetURL,
            };
            this._logInfo('✅ Youtube Watch mission completed on target page', resultData);
            this.emitMissionCompleted(true, 'successful_completion', resultData);
            return {
                success: true,
                reason: 'successful_completion',
                data: resultData,
            };
        }
        catch (error) {
            const enhancedError = await this.nav.handleNavigationError(error, {
                operation: 'youtube_watch_target_page_execution',
                missionType: this.getModuleType(),
                targetURL: options.targetURL,
            });
            this._logError('❌ Youtube Watch mission failed on target page', enhancedError);
            this.emitMissionCompleted(false, 'error', {
                error: enhancedError.message,
                targetURL: options.targetURL,
            });
            throw enhancedError;
        }
    }
    _selectTargetPageBehaviors() {
        return [
            { name: 'watchWaitWithMouse', optional: false },
        ];
    }
    async _executeTargetPageBehavior(behavior, page, options) {
        this._logDebug(`Executing behavior: ${behavior}`);
        let success = false;
        switch (behavior) {
            case 'watchWaitWithMouse':
                await this._performWatchWaitWithMouse(page, options);
                success = true;
                break;
            default:
                this._logWarn(`Unknown target page behavior selected for Youtube Watch: ${behavior}`);
                break;
        }
        if (!success) {
            this._logDebug(`Behavior '${behavior}' did not execute successfully or was skipped.`);
        }
    }
    async _performWatchWaitWithMouse(page, options) {
        const totalWatchTime = modules_helper_1.ModulesHelper.Helpers.randomBetween(this.WATCH_DURATION_MS.min, this.WATCH_DURATION_MS.max);
        const endTime = Date.now() + totalWatchTime;
        this._logInfo('Starting watch wait with intermittent mouse movement.', {
            totalWatchTime,
        });
        while (Date.now() < endTime) {
            const remainingTime = endTime - Date.now();
            const idleSegment = Math.min(remainingTime, modules_helper_1.ModulesHelper.Helpers.randomBetween(this.IDLE_SEGMENT_MS.min, this.IDLE_SEGMENT_MS.max));
            if (idleSegment > 0) {
                await modules_helper_1.ModulesHelper.Helpers.waitWithFeed(idleSegment, options.watchdogFeed);
            }
            if (Date.now() >= endTime) {
                break;
            }
            await modules_helper_1.ModulesHelper.Helpers.mouseMove(page, {
                steps: { min: 8, max: 22 },
                delay: { min: 12, max: 28 },
                pauseChance: 0.35,
                pauseDuration: { min: 120, max: 900 },
            });
            if (options.watchdogFeed) {
                options.watchdogFeed();
            }
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
exports.default = YoutubeWatchMission;
//# sourceMappingURL=youtube-watch.js.map
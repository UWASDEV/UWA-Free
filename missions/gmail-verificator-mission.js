"use strict";
/**
 * @description A mission to verify Gmail accounts through a complex 11-step process involving 2FA and conditional navigation.
 * @author UWAS.DEV
 * @date 2025-11-26
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
const modules_helper_1 = require("../modules-helper");
class GmailVerificatorMission extends modules_helper_1.ModulesHelper.BaseMission {
    // --- Mission State ---
    credentials = null;
    importedFilename = null;
    LOGIN_BUTTON_SELECTOR = '#root > div:nth-child(1) > header > div > div.header__aside > a.button.button--medium.header__aside__button.button--desktop.button--tablet.button--mobile';
    GOOGLE_MAIL_URL = 'https://mail.google.com/mail/u/0/';
    static getMetadata() {
        return {
            id: 'gmail_verificator',
            title: 'Gmail Verificator',
            description: 'Verifies Gmail accounts using a complex 11-step conditional process with 2FA support.',
            icon: '🛡️',
            category: 'verification',
            enabled: true,
            order: 35, // Placed after existing Gmail missions
            version: '1.0.0',
        };
    }
    static getDefaultConfig() {
        return {
            ...super.getDefaultConfig(),
        };
    }
    getConfigSchema() {
        return {
            type: 'object',
            properties: {},
        };
    }
    validate(_config) {
        return Promise.resolve();
    }
    async _run(page, options) {
        this._logInfo('🛡️ Starting Gmail Verificator Mission.');
        if (!options.importedCookieFilename) {
            throw this._createError('This mission requires an imported cookie filename to parse credentials.', 'MISSING_CONTEXT');
        }
        this.importedFilename = options.importedCookieFilename;
        // Extract credentials early to fail fast if filename is invalid
        this.credentials = this._extractCredentialsFromFilename(this.importedFilename);
        if (!this.credentials) {
            throw this._createError(`Failed to extract credentials from filename: ${this.importedFilename}`, 'CONFIG_ERROR');
        }
        this._logInfo(`Credentials extracted successfully for user: ${this.credentials.username}`);
        const startTime = Date.now();
        try {
            await this.nav.validateNavigationContext({ page });
            const { completedBehaviors } = await this.interactionService.executeBehaviorLoop({
                page,
                options,
                behaviorSelector: this._selectBehaviors.bind(this),
                behaviorExecutor: this._executeBehavior.bind(this),
                loopType: 'gmail_verification_sequence',
                executionMode: 'sequential',
            });
            const totalTime = Date.now() - startTime;
            this._logInfo('✅ Gmail Verificator Mission completed sequence.', { totalTime, completedBehaviors });
            // The final result is determined in the last step (finalCheckAndExport),
            // but we return success here as the sequence finished without throwing.
            return { success: true, reason: 'Mission sequence completed.' };
        }
        catch (error) {
            // If it's a known abort or graceful exit, handle it
            if (error.name === 'AbortError' || error.code === 'OPERATION_ABORTED') {
                this._logWarn('Gmail Verificator Mission was aborted by user.');
                this.emitMissionCompleted(false, 'user_abort', { error: error.message });
            }
            else {
                this._logError('Gmail Verificator Mission failed.', error);
                this.emitMissionCompleted(false, 'error', { error: error.message });
            }
            throw error;
        }
    }
    _selectBehaviors() {
        // The 11-step sequence strictly defined in the requirements
        return [
            // Initial behaviors
            { name: 'initial_wait', optional: false },
            { name: 'initial_mousemove', optional: false },
            { name: 'initial_gmail_click', optional: false },
            // Main sequence
            { name: 'step1_checkLoginButton', optional: false },
            { name: 'step1a_checkIdentifierNext', optional: false },
            { name: 'step2_checkInboxAndClick', optional: false },
            { name: 'step3_checkLoginButtonAgain', optional: false },
            { name: 'step4_handleEmailInput', optional: false },
            { name: 'step5_handlePasswordInput', optional: false },
            { name: 'step6_handleTotpInput', optional: false },
            { name: 'step7_checkRecovery1', optional: false },
            { name: 'step8_checkRecovery2', optional: false },
            { name: 'step9_checkRecovery3', optional: false },
            { name: 'step10_waitAndMove', optional: false },
            { name: 'step11_finalCheckAndExport', optional: false },
        ];
    }
    async _executeBehavior(behavior, page, options) {
        this._logDebug(`Executing behavior step: ${behavior}`);
        let success = false;
        switch (behavior) {
            case 'initial_wait':
                await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(2000, 4000));
                success = true;
                break;
            case 'initial_mousemove':
                await modules_helper_1.ModulesHelper.Helpers.mouseMove(page, { steps: { min: 15, max: 30 } });
                success = true;
                break;
            case 'initial_gmail_click':
                success = await this._interactionServiceClick(page, '#gb > div.gb_M.gb_1.gb_Qf.gb_Xf > div:nth-child(1) > a');
                break;
            case 'step1_checkLoginButton':
                success = await this._checkLoginButton(page);
                break;
            case 'step1a_checkIdentifierNext':
                success = await this._checkIdentifierNext(page);
                break;
            case 'step2_checkInboxAndClick':
                success = await this._checkInboxAndClick(page);
                break;
            case 'step3_checkLoginButtonAgain':
                success = await this._checkLoginButtonAgain(page);
                break;
            case 'step4_handleEmailInput':
                success = await this._handleEmailInput(page);
                break;
            case 'step5_handlePasswordInput':
                success = await this._handlePasswordInput(page);
                break;
            case 'step6_handleTotpInput':
                success = await this._handleTotpInput(page, options);
                break;
            case 'step7_checkRecovery1':
                success = await this._simpleClickIfVisibleStep7(page, '#yDmH0d > c-wiz > main > div.JYXaTc.lUWEgd > div > div.FO2vFd > div > div > button > span');
                break;
            case 'step8_checkRecovery2':
                success = await this._simpleClickIfVisibleStep8(page, '#yDmH0d > c-wiz.SSPGKf.JHVYhd > div > div > div > div > div.MFXio > button.VfPpkd-LgbsSe.ksBjEc.lKxP2d.LQeN7.MXew1e.lJTaZd');
                break;
            case 'step9_checkRecovery3':
                success = await this._simpleClickIfVisibleStep9(page, '#yDmH0d > c-wiz:nth-child(10) > div > div > div > div > div > div.MFXio > button.VfPpkd-LgbsSe.ksBjEc.lKxP2d.LQeN7.MXew1e.lJTaZd');
                break;
            case 'step10_waitAndMove':
                await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(2000, 4000));
                await modules_helper_1.ModulesHelper.Helpers.mouseMove(page, { steps: { min: 10, max: 20 } });
                success = true;
                break;
            case 'step11_finalCheckAndExport':
                success = await this._finalCheckAndExport(page, options);
                break;
            default:
                this._logWarn(`Unknown behavior: ${behavior}`);
                success = false;
        }
        if (!success) {
            // In this specific mission, "not visible" usually means "skip step", which is technically a success for that step's logic.
            // However, if a critical interaction fails (e.g., typing failed when element WAS visible), the helper methods should throw.
            // So if we return false here, it implies a logic error or unhandled state.
            this._logDebug(`ModulesHelper.Behavior ${behavior} completed (potentially skipped or no-op).`);
        }
    }
    // --- Step Implementations ---
    /**
     * Step 1: Check if Login button is visible. If yes, click and go to step 2. If no, skip to step 2.
     */
    async _checkLoginButton(page) {
        const isVisible = await page.isVisible(this.LOGIN_BUTTON_SELECTOR);
        if (isVisible) {
            this._logInfo('Step 1: Login button visible. Clicking.');
            await this.interactionService.handleElementInteraction(page, {
                selectors: [this.LOGIN_BUTTON_SELECTOR],
                actions: ['hover', 'click', 'wait', 'wait'],
                expectsNavigation: false, // Requirement doesn't strictly specify nav wait here, but implies proceeding.
            });
        }
        else {
            this._logInfo('Step 1: Login button not visible. Skipping.');
        }
        return true;
    }
    /**
     * Step 1a: Check if #identifierNext > div > button is visible. If yes, click.
     */
    async _checkIdentifierNext(page) {
        const selector = '#identifierNext > div > button';
        const isVisible = await page.isVisible(selector);
        if (isVisible) {
            this._logInfo('Step 1a: IdentifierNext button visible. Clicking.');
            await this.interactionService.handleElementInteraction(page, {
                selectors: [selector],
                actions: ['hover', 'click', 'wait'],
                expectsNavigation: false,
            });
        }
        else {
            this._logInfo('Step 1a: IdentifierNext button not visible. Skipping.');
        }
        return true;
    }
    /**
     * Step 2: Check if URL is inbox. If yes, perform dynamic click + wait + moves. If no, skip to 3.
     */
    async _checkInboxAndClick(page) {
        if (this._isInboxUrl(page.url())) {
            this._logInfo('Step 2: On Inbox URL. Attempting dynamic interaction.');
            await this._clickRandomEmail(page);
        }
        else {
            this._logInfo('Step 2: Not on Inbox URL. Skipping.');
        }
        return true;
    }
    /**
     * Step 3: Check Login button visibility again. If visible, click. If no, skip to 4.
     */
    async _checkLoginButtonAgain(page) {
        const isVisible = await page.isVisible(this.LOGIN_BUTTON_SELECTOR);
        if (isVisible) {
            this._logInfo('Step 3: Login button visible. Clicking.');
            await this.interactionService.handleElementInteraction(page, {
                selectors: [this.LOGIN_BUTTON_SELECTOR],
                actions: ['hover', 'click', 'wait', 'wait'],
                expectsNavigation: false,
            });
        }
        else {
            this._logInfo('Step 3: Login button not visible. Skipping.');
        }
        return true;
    }
    /**
     * Step 4: Check #identifierId (Email). If visible, enter email & click Next. If no, skip to 5.
     */
    async _handleEmailInput(page) {
        const selector = '#identifierId';
        const nextButton = '#identifierNext';
        // 1. Check for Email Input (Standard Login)
        const isEmailInputVisible = await page.isVisible(selector);
        if (isEmailInputVisible) {
            this._logInfo('Step 4: Email input visible. Entering email.');
            if (!this.credentials?.username) {
                throw this._createError('Credentials missing username for Step 4', 'DATA_ERROR');
            }
            await this.interactionService.handleElementInteraction(page, {
                selectors: [selector],
                actions: ['click', 'wait', 'type'],
                typeText: this.credentials.username,
                interactionOptions: { type: { typos: { min: 0, max: 2 } } },
            });
            await this.interactionService.handleElementInteraction(page, {
                selectors: [nextButton],
                actions: ['hover', 'wait', 'click'],
                expectsNavigation: false,
            });
            await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(1000, 2000));
        }
        else if (this.credentials?.username) {
            // 2. Check for Username (Account Chooser) - Alternative Flow
            const usernameSelector = `text=${this.credentials.username}`;
            try {
                // Wait briefly to ensure dynamic content is loaded
                await page.waitForSelector(usernameSelector, { state: 'visible', timeout: 3000 });
                this._logInfo(`Step 4: Username '${this.credentials.username}' found in Account Chooser. Clicking.`);
                await this.interactionService.handleElementInteraction(page, {
                    selectors: [usernameSelector],
                    actions: ['hover', 'click', 'wait'],
                    expectsNavigation: false,
                });
                // No need to click Next button here as clicking the account acts as Next
                await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(1000, 2000));
                // CRITICAL FIX: Wait for password field to appear to confirm transition
                // This ensures that we don't rush to Step 5 before the page is ready
                try {
                    const passwordContainer = '#password';
                    await page.waitForSelector(passwordContainer, { state: 'visible', timeout: 5000 });
                    this._logInfo('Step 4: Password field appeared after account selection. Transition confirmed.');
                }
                catch (e) {
                    this._logWarn('Step 4: Warning - Password field did not appear within timeout after account selection.');
                }
            }
            catch {
                this._logInfo('Step 4: Neither Email input nor Username in Account Chooser visible. Skipping.');
            }
        }
        else {
            this._logInfo('Step 4: Email input not visible and no username to check. Skipping.');
        }
        return true;
    }
    /**
     * Step 5: Check #password. If visible, enter password & click Next. If no, skip to 6.
     */
    async _handlePasswordInput(page) {
        const selector = '#password input[type="password"]'; // Use specific input
        // Sometimes #password is a wrapper div, playwright needs the input for typing.
        // However, checking visibility on the wrapper ID provided in requirements is safer for the "if" condition.
        const containerSelector = '#password';
        const nextButton = '#passwordNext';
        if (await page.isVisible(containerSelector)) {
            this._logInfo('Step 5: Password input visible. Entering password.');
            if (!this.credentials?.password) {
                throw this._createError('Credentials missing password for Step 5', 'DATA_ERROR');
            }
            // We target the input for typing
            await this.interactionService.handleElementInteraction(page, {
                selectors: [selector],
                actions: ['click', 'wait', 'type'],
                typeText: this.credentials.password,
                interactionOptions: { type: { typos: { min: 0, max: 2 } } },
            });
            await this.interactionService.handleElementInteraction(page, {
                selectors: [nextButton],
                actions: ['hover', 'wait', 'click', 'wait', 'wait'],
                expectsNavigation: false,
            });
            await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(1000, 2000));
        }
        else {
            this._logInfo('Step 5: Password input not visible. Skipping.');
        }
        return true;
    }
    /**
     * Step 6: Check #totpPin. If visible, get code via extension & click Next. If no, skip to 7.
     */
    async _handleTotpInput(page, options) {
        const selector = '#totpPin';
        const nextButton = '#totpNext';
        if (await page.isVisible(selector)) {
            this._logInfo('Step 6: TOTP input visible. Generating code.');
            if (!this.credentials?.secretKey) {
                throw this._createError('Credentials missing secretKey for Step 6', 'DATA_ERROR');
            }
            if (!this.extensionsOrchestrator) {
                throw this._createError('ExtensionsOrchestrator required for TOTP generation', 'MISSING_DEPENDENCY');
            }
            const code = await this.extensionsOrchestrator.executeCapability({
                page,
                config: options.config,
                capability: '2fa-authentication',
                shortcode: 'GET_CODE',
                sessionId: this.sessionId,
                abortSignal: options.abortSignal,
                args: [this.credentials.secretKey],
                instanceCache: new Map(),
            });
            if (!code) {
                throw this._createError('Failed to generate TOTP code', 'EXTENSION_ERROR');
            }
            await this.interactionService.handleElementInteraction(page, {
                selectors: [selector],
                actions: ['click', 'type'],
                typeText: code,
                interactionOptions: { type: { typos: { min: 0, max: 2 } } },
            });
            await this.interactionService.handleElementInteraction(page, {
                selectors: [nextButton],
                actions: ['hover', 'click'],
                expectsNavigation: false,
            });
            await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(1000, 2000));
        }
        else {
            this._logInfo('Step 6: TOTP input not visible. Skipping.');
        }
        return true;
    }
    /**
     * Helper for Steps 7: Simple "Click if visible" logic
     */
    async _simpleClickIfVisibleStep7(page, selector) {
        if (await page.isVisible(selector)) {
            this._logInfo(`Clicking visible element: ${selector}`);
            await this.interactionService.handleElementInteraction(page, {
                selectors: [selector],
                actions: ['hover', 'wait', 'click'],
                maxRetries: 3,
                expectsNavigation: true,
            });
            await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(1000, 1500));
        }
        else {
            this._logDebug(`Element not visible, skipping: ${selector}`);
        }
        return true;
    }
    /**
     * Helper for Steps 8: Simple "Click if visible" logic
     */
    async _simpleClickIfVisibleStep8(page, selector) {
        if (await page.isVisible(selector)) {
            this._logInfo(`Clicking visible element: ${selector}`);
            await this.interactionService.handleElementInteraction(page, {
                selectors: [selector],
                actions: ['hover', 'wait', 'click'],
                maxRetries: 3,
            });
            await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(1500, 2000));
        }
        else {
            this._logDebug(`Element not visible, skipping: ${selector}`);
        }
        return true;
    }
    /**
     * Helper for Steps 8, 9: Simple "Click if visible" logic
     */
    async _simpleClickIfVisibleStep9(page, selector) {
        if (await page.isVisible(selector)) {
            this._logInfo(`Clicking visible element: ${selector}`);
            await this.interactionService.handleElementInteraction(page, {
                selectors: [selector],
                actions: ['hover', 'wait', 'click'],
                maxRetries: 3,
                expectsNavigation: true,
            });
            await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(1500, 2000));
        }
        else {
            this._logDebug(`Element not visible, skipping: ${selector}`);
        }
        return true;
    }
    /**
     * Simple helper to click an element using InteractionService
     */
    _interactionServiceClick(page, selector) {
        return this.interactionService.handleElementInteraction(page, {
            selectors: [selector],
            actions: ['hover', 'wait', 'click'],
            maxRetries: 1,
        });
    }
    /**
     * Step 11: Final check.
     * If on Inbox: export "valid-...", click dynamic, random moves.
     * If NOT on Inbox: export "disabled-...", finish.
     */
    async _finalCheckAndExport(page, options) {
        // Add 6 seconds delay as requested to allow URL to settle
        this._logInfo('Step 11: Waiting 6 seconds for URL to stabilize...');
        await modules_helper_1.ModulesHelper.Helpers.delay(6000);
        const isOnInbox = this._isInboxUrl(page.url());
        if (!this.importedFilename) {
            throw this._createError('Imported filename lost in context.', 'STATE_ERROR');
        }
        if (isOnInbox) {
            this._logInfo('Step 11: Valid login detected (Inbox). Exporting valid cookie.');
            const validFilename = `valid-${this.importedFilename}`;
            await this._exportIntermediateCookie(options, validFilename);
            // Post-export interactions: Perform dynamic click
            this._logInfo('Step 11: Performing post-export dynamic interaction.');
            await this._clickRandomEmail(page);
            this.emitMissionCompleted(true, 'successful_completion', { success: true, status: 'valid' });
        }
        else {
            this._logInfo('Step 11: Inbox not reached. Marking as disabled/failed.');
            const disabledFilename = `disabled-${this.importedFilename}`;
            await this._exportIntermediateCookie(options, disabledFilename);
            this.emitMissionCompleted(true, 'successful_completion', { success: true, status: 'disabled' });
        }
        return true;
    }
    // --- ModulesHelper.Helpers ---
    /**
     * Helper method to handle dynamic selector interaction (email threads).
     * Finds all visible elements matching 'span[data-thread-id]', selects one randomly,
     * clicks, waits 2-4s, and moves mouse.
     */
    async _clickRandomEmail(page) {
        const emailSelector = 'span[data-thread-id]';
        this._logInfo('Attempting dynamic interaction with email threads.');
        try {
            const success = await this.interactionService.handleElementInteraction(page, {
                selectors: [emailSelector],
                actions: ['hover', 'click'],
                maxRetries: 3,
                // InteractionService automatically shuffles found elements, satisfying "random" requirement.
            });
            if (success) {
                this._logInfo('Dynamic click successful.');
                // 2-4 seconds wait as requested
                await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(2000, 4000));
                // Random mouse move as requested
                await modules_helper_1.ModulesHelper.Helpers.mouseMove(page, { steps: { min: 15, max: 30 } });
            }
            else {
                this._logInfo('No interactable email threads found. Skipping interaction.');
            }
        }
        catch (error) {
            this._logWarn('Error during dynamic element interaction', error);
        }
    }
    _isInboxUrl(url) {
        // Only check for base URL, removed strict #inbox hash check as requested
        return url.includes(this.GOOGLE_MAIL_URL);
    }
    /**
     * Parses the filename to extract credentials based on a "read from end" strategy.
     * The strategy assumes the file format ends with: ...-USERNAME-PASSWORD-SECRET.json
     *
     * Logic:
     * 1. Remove .json extension.
     * 2. Split by hyphen (-).
     * 3. Extract the last 3 parts as Username, Password, and Secret Key.
     * 4. Any preceding parts (prefixes, etc.) are ignored.
     */
    _extractCredentialsFromFilename(filename) {
        try {
            let name = filename;
            if (name.endsWith('.json')) {
                name = name.slice(0, -5);
            }
            const parts = name.split('-');
            if (parts.length < 3) {
                this._logError(`Filename format invalid (not enough parts to extract credentials): ${filename}`);
                return null;
            }
            // Extract the last 3 parts: [..., username, password, secretKey]
            const [username, password, secretKey] = parts.slice(-3);
            this._logDebug(`Parsed credentials from filename. User: ${username}, Password Length: ${password?.length}, Secret Length: ${secretKey?.length}`);
            if (!username || !password || !secretKey) {
                this._logError(`Failed to extract complete credentials from filename: ${filename}`);
                return null;
            }
            return { username, password, secretKey };
        }
        catch (error) {
            this._logError('Error parsing filename credentials', error);
            return null;
        }
    }
}
exports.default = GmailVerificatorMission;
//# sourceMappingURL=gmail-verificator-mission.js.map
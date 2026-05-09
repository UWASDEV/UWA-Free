"use strict";
/**
 * @description A mission to automate the activation of 2-Factor Authentication on a Gmail account.
 * @author UWAS.DEV
 * @date 2025-11-14
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
const modules_helper_1 = require("../modules-helper");
class Gmail2faActivatorMission extends modules_helper_1.ModulesHelper.BaseMission {
    // --- Mission State ---
    secretKey = null;
    importedFilename = null;
    static getMetadata() {
        return {
            id: 'gmail_2fa_activator',
            title: 'Gmail 2FA Activator',
            description: 'A mission to activate 2FA on a Gmail account using an authenticator app.',
            icon: '🔐',
            category: 'account',
            enabled: true,
            order: 32,
            version: '1.0.0',
        };
    }
    static getDefaultConfig() {
        return {
            ...super.getDefaultConfig(),
            enabled: true,
        };
    }
    getConfigSchema() {
        return {};
    }
    validate(_config) {
        return Promise.resolve();
    }
    async _run(page, options) {
        this._logInfo('🔐 Starting Gmail 2FA Activator Mission.');
        if (!options.importedCookieFilename) {
            throw this._createError('This mission requires an imported cookie, but no importedCookieFilename was provided in the execution context.', 'MISSING_CONTEXT');
        }
        this.importedFilename = options.importedCookieFilename;
        this._logInfo(`Mission will use imported cookie filename as a base: ${this.importedFilename}`);
        const startTime = Date.now();
        try {
            await this.nav.validateNavigationContext({ page });
            this._logInfo('🔐 Initial navigation state asserted successfully.');
            const { completedBehaviors } = await this.interactionService.executeBehaviorLoop({
                page,
                options,
                behaviorSelector: this._selectBehaviors.bind(this),
                behaviorExecutor: this._executeBehavior.bind(this),
                loopType: 'gmail_2fa_activation_sequence',
                executionMode: 'sequential',
            });
            const totalTime = Date.now() - startTime;
            this._logInfo('✅ Gmail 2FA Activator Mission completed successfully.', { totalTime, completedBehaviors });
            this.emitMissionCompleted(true, 'successful_completion', { success: true, timeSpent: totalTime });
            return { success: true, reason: 'Mission completed successfully.' };
        }
        catch (error) {
            // Handle the specific case where the profile button is not found, indicating a disabled account.
            if (error.message && error.message.includes("'clickProfile' failed")) {
                this._logWarn('Profile button not found. The account might be disabled. Exporting cookie with "disabled-" prefix.');
                if (!this.importedFilename) {
                    throw this._createError('importedFilename is null, cannot export disabled cookie.', 'STATE_ERROR');
                }
                const disabledFilename = `disabled-${this.importedFilename}`;
                await this._exportIntermediateCookie(options, disabledFilename);
                this._logInfo(`Successfully exported cookie for disabled account as: ${disabledFilename}`);
                this.emitMissionCompleted(true, 'successful_completion', { success: true, reason: 'Account appears to be disabled.' });
                return { success: true, reason: 'Account appears to be disabled, cookie exported with prefix.' };
            }
            if (error.name === 'AbortError' || error.code === 'OPERATION_ABORTED') {
                this._logWarn('Gmail 2FA Activator Mission was aborted by user.');
                this.emitMissionCompleted(false, 'user_abort', { error: error.message });
            }
            else {
                this._logError('Gmail 2FA Activator Mission failed.', error);
                this.emitMissionCompleted(false, 'error', { error: error.message });
            }
            throw error;
        }
    }
    _selectBehaviors() {
        return [
            { name: 'clickProfile', optional: false },
            { name: 'clickManageYourAccount', optional: false },
            { name: 'clickSecurityTab', optional: false },
            { name: 'clickAuthenticator', optional: false },
            { name: 'handlePasswordPrompt', optional: false },
            { name: 'clickSetupAuthenticator', optional: false },
            { name: 'clickCannotScan', optional: false },
            { name: 'readSecretKey', optional: false },
            { name: 'clickBackToQr', optional: false },
            { name: 'clickNextAfterKey', optional: false },
            { name: 'mouseMove', optional: false },
            { name: 'randomWait', optional: false },
            { name: 'enterAndVerifyCodeWithRetry', optional: false },
            { name: 'clickEnable', optional: false },
            { name: 'exportCookieWithSecret', optional: false },
            { name: 'clickTurnOn2FA', optional: false },
            { name: 'skipPhoneNumber', optional: false },
            { name: 'confirmSkip', optional: false },
            { name: 'clickDone', optional: false },
            { name: 'exportCookieWithSecret', optional: false },
            { name: 'mouseMove', optional: false },
        ];
    }
    async _executeBehavior(behavior, page, options) {
        this._logDebug(`Executing behavior: ${behavior}`);
        let success = false;
        switch (behavior) {
            case 'randomWait':
                this._logInfo('Performing random wait behavior.');
                await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(2000, 4000));
                success = true;
                break;
            case 'mouseMove':
                this._logInfo('Performing mouse move behavior.');
                success = await modules_helper_1.ModulesHelper.Helpers.mouseMove(page, {
                    steps: { min: 15, max: 30 },
                    delay: { min: 10, max: 20 },
                });
                break;
            case 'clickProfile':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#gb > div.gb_z > a'],
                    actions: ['hover', 'click', 'wait', 'wait', 'wait'],
                    maxRetries: 3,
                    expectsNavigation: false,
                });
                break;
            case 'clickManageYourAccount':
                success = await this.interactionService.handleElementInteraction(page, {
                    frameSelectors: ['iframe[name="account"]'],
                    selectors: ['#yDmH0d > c-wiz > div > div > div > div > div.sZ3gbf > div > div.oNTUye > span > a'],
                    actions: ['click'],
                    maxRetries: 3,
                    expectsNavigation: true,
                });
                break;
            case 'clickSecurityTab':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['a[href*="security"]'],
                    actions: ['hover', 'click'],
                    maxRetries: 3,
                    expectsNavigation: true,
                });
                break;
            case 'clickAuthenticator':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['a[href*="two-step-verification/authenticator"]'],
                    actions: ['hover', 'click'],
                    maxRetries: 3,
                    expectsNavigation: true,
                });
                break;
            case 'handlePasswordPrompt': {
                const passwordSelector = '#password input[type="password"]';
                const isPasswordVisible = await page.locator(passwordSelector).isVisible({ timeout: 5000 }).catch(() => false);
                if (!isPasswordVisible) {
                    this._logInfo('Password prompt not found, skipping password entry.');
                    success = true;
                    break;
                }
                this._logInfo('Password prompt detected. Extracting and entering password.');
                const password = this._extractPasswordFromFilename();
                if (!password) {
                    throw this._createError('Could not extract password from the imported filename.', 'STATE_ERROR');
                }
                await this.interactionService.handleElementInteraction(page, {
                    selectors: [passwordSelector],
                    actions: ['click', 'type'],
                    typeText: password,
                    maxRetries: 3,
                    interactionOptions: { type: { typos: { min: 0, max: 2 } } },
                });
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#passwordNext > div > button'],
                    actions: ['hover', 'click'],
                    maxRetries: 3,
                    expectsNavigation: true,
                });
                break;
            }
            case 'clickSetupAuthenticator':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#yDmH0d > c-wiz > div > div:nth-child(2) > div:nth-child(2) > c-wiz > div > div > div.ciRgbc.Ru61We > div.Mwd2Jc > div > div > div > button'],
                    actions: ['hover', 'click', 'wait', 'wait'],
                    maxRetries: 3,
                    expectsNavigation: false,
                });
                break;
            case 'clickCannotScan':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#yDmH0d > div.oDVwOd.PHZhJd.iWO5td > div > div.GheHHf.GiAE0b.KNyhq.PjYkrd.iWO5td > span > div > div > div > div:nth-child(2) > center > div > div > button'],
                    actions: ['hover', 'click'],
                    maxRetries: 3,
                    expectsNavigation: false,
                });
                break;
            case 'readSecretKey':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#yDmH0d > div.oDVwOd.PHZhJd.iWO5td > div > div.GheHHf.GiAE0b.KNyhq.PjYkrd.iWO5td > span > div > div > ol > li:nth-child(2) > div > strong'],
                    actions: ['read'],
                    onRead: text => {
                        this.secretKey = text.replace(/\s/g, ''); // Remove spaces
                        this._logInfo(`Successfully read and stored secret key: ${this.secretKey}`);
                    },
                });
                // We also need to check if the key was actually read
                if (success && !this.secretKey) {
                    throw this._createError('Read action was successful, but the secret key is still null.', 'STATE_ERROR');
                }
                break;
            case 'clickBackToQr':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#yDmH0d > div.oDVwOd.PHZhJd.iWO5td > div > div.GheHHf.GiAE0b.KNyhq.PjYkrd.iWO5td > div.sRKBBe > div > div.VfPpkd-dgl2Hf-ppHlrf-sM5MNb > button'],
                    actions: ['hover', 'click', 'wait', 'wait'],
                    maxRetries: 3,
                    expectsNavigation: false,
                });
                break;
            case 'clickNextAfterKey':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#yDmH0d > div.oDVwOd.PHZhJd.iWO5td > div > div.GheHHf.GiAE0b.KNyhq.PjYkrd.iWO5td > div.sRKBBe > div > div:nth-child(2) > div:nth-child(2) > button'],
                    actions: ['hover', 'click'],
                    maxRetries: 3,
                    expectsNavigation: false,
                });
                break;
            case 'enterAndVerifyCodeWithRetry': {
                /**
                 * This behavior attempts to enter the 2FA verification code and verify it.
                 * If verification fails (e.g., due to an expired code), it will automatically
                 * fetch a new code and retry up to a maximum number of attempts.
                 */
                if (!this.secretKey) {
                    throw this._createError('Cannot get verification code because secretKey is null.', 'STATE_ERROR');
                }
                if (!this.extensionsOrchestrator) {
                    throw this._createError('ExtensionsOrchestrator is not available.', 'MISSING_DEPENDENCY');
                }
                const maxRetries = 5;
                const verifyButtonSelector = '#yDmH0d > div.oDVwOd.PHZhJd.iWO5td > div > div.GheHHf.GiAE0b.KNyhq.PjYkrd.iWO5td > div.sRKBBe > div > div:nth-child(2) > div:nth-child(3) > button';
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    this._logInfo(`Attempt ${attempt}/${maxRetries}: Requesting and entering 2FA code.`);
                    const verificationCode = await this.extensionsOrchestrator.executeCapability({
                        page,
                        config: options.config,
                        capability: '2fa-authentication',
                        shortcode: 'GET_CODE',
                        sessionId: this.sessionId,
                        abortSignal: options.abortSignal,
                        args: [this.secretKey],
                        instanceCache: this.extensionInstances,
                    });
                    if (!verificationCode) {
                        throw this._createError('Failed to get a verification code from the authenticator extension.', 'EXTENSION_ERROR');
                    }
                    this._logInfo(`Received verification code: ${verificationCode}. Typing it...`);
                    await this.interactionService.handleElementInteraction(page, {
                        selectors: ['#c0'],
                        actions: ['click', 'type'],
                        typeText: verificationCode,
                        interactionOptions: { type: { typos: { min: 0, max: 1 } } },
                        maxRetries: 3,
                    });
                    this._logInfo('Clicking verify button.');
                    await this.interactionService.handleElementInteraction(page, {
                        selectors: [verifyButtonSelector],
                        actions: ['click'],
                        maxRetries: 3,
                        expectsNavigation: false,
                    });
                    // Wait a moment for the UI to update and check the result
                    await modules_helper_1.ModulesHelper.Helpers.delay(2500);
                    const isVerifyButtonStillVisible = await page.locator(verifyButtonSelector).isVisible().catch(() => false);
                    if (!isVerifyButtonStillVisible) {
                        this._logInfo(`Verification successful on attempt ${attempt}. Proceeding to the next step.`);
                        success = true;
                        break; // Exit the loop on success
                    }
                    this._logWarn(`Verification failed on attempt ${attempt}. Verify button is still visible. Retrying...`);
                }
                if (!success) {
                    throw this._createError(`Failed to verify 2FA code after ${maxRetries} attempts.`, 'VERIFICATION_FAILED');
                }
                break;
            }
            case 'clickEnable':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#ow8 > div > div > div:nth-child(3) > div > div > div.Jcq15c > div > div'],
                    actions: ['hover', 'click'],
                    maxRetries: 3,
                    expectsNavigation: true,
                });
                break;
            case 'clickTurnOn2FA':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#yDmH0d > c-wiz > div > div:nth-child(2) > div:nth-child(2) > c-wiz > div > div:nth-child(2) > div.qsqhnc > div > button'],
                    actions: ['hover', 'click'],
                    maxRetries: 3,
                    expectsNavigation: false,
                });
                break;
            case 'skipPhoneNumber':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#yDmH0d > div.uW2Fw-Sx9Kwc.uW2Fw-Sx9Kwc-OWXEXe-n2to0e.uW2Fw-qON5Qe-FoKg4d-Sx9Kwc-fZiSAe.yaahMe.uW2Fw-Sx9Kwc-OWXEXe-FNFY6c > div.uW2Fw-wzTsW > div > div.uW2Fw-T0kwCb > div:nth-child(3) > button'],
                    actions: ['hover', 'click'],
                    maxRetries: 3,
                    expectsNavigation: false,
                });
                break;
            case 'confirmSkip':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#yDmH0d > div.uW2Fw-Sx9Kwc.uW2Fw-Sx9Kwc-OWXEXe-n2to0e.uW2Fw-qON5Qe-FoKg4d-Sx9Kwc-fZiSAe.yaahMe.uW2Fw-Sx9Kwc-OWXEXe-FNFY6c > div.uW2Fw-wzTsW > div > div.uW2Fw-T0kwCb > div:nth-child(3) > button'],
                    actions: ['hover', 'click'],
                    maxRetries: 3,
                    expectsNavigation: false,
                });
                await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(1500, 3000));
                break;
            case 'clickDone':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#yDmH0d > div.uW2Fw-Sx9Kwc.uW2Fw-Sx9Kwc-OWXEXe-n2to0e.uW2Fw-qON5Qe-FoKg4d-Sx9Kwc-fZiSAe.yaahMe.uW2Fw-Sx9Kwc-OWXEXe-FNFY6c > div.uW2Fw-wzTsW > div > div.uW2Fw-T0kwCb > div > button'],
                    actions: ['hover', 'click'],
                    maxRetries: 3,
                    expectsNavigation: false,
                });
                break;
            case 'exportCookieWithSecret': {
                if (!this.importedFilename) {
                    // This check is crucial, but the main logic will now be in the _run's catch block for disabled accounts.
                    throw this._createError('importedFilename is null, cannot export cookie.', 'STATE_ERROR');
                }
                if (!this.secretKey) {
                    throw this._createError('secretKey is null, cannot append to filename.', 'STATE_ERROR');
                }
                const baseFilename = this.importedFilename.replace('.json', '');
                const exportFilename = `${baseFilename}-${this.secretKey}.json`;
                this._logInfo(`Exporting intermediate cookie with secret key in filename: ${exportFilename}`);
                await this._exportIntermediateCookie(options, exportFilename);
                success = true;
                break;
            }
            default:
                this._logWarn(`Unknown behavior selected: ${behavior}`);
        }
        if (!success) {
            throw this._createError(`ModulesHelper.Behavior '${behavior}' failed after multiple retries and was not optional.`, 'BEHAVIOR_FAILED');
        }
    }
    /**
     * @method _extractPasswordFromFilename
     * @description Extracts the password from the imported cookie filename based on a specific pattern.
     *              The password is the part between the last two hyphens.
     * @private
     * @returns {string | null} The extracted password or null if not found.
     */
    _extractPasswordFromFilename() {
        if (!this.importedFilename) {
            this._logError('Cannot extract password, importedFilename is null.');
            return null;
        }
        // Clean up the .json extension first
        const baseFilename = this.importedFilename.replace('.json', '');
        const parts = baseFilename.split('-');
        // We need at least 3 parts for this logic to work (e.g., 'gmail-password-email')
        if (parts.length < 3) {
            this._logError(`Filename "${this.importedFilename}" does not have enough parts to extract a password.`);
            return null;
        }
        // The password is the second to last part
        const password = parts[parts.length - 2];
        this._logInfo(`Extracted password from filename: ${password}`);
        return password;
    }
}
exports.default = Gmail2faActivatorMission;
//# sourceMappingURL=gmail-2fa-activator.js.map
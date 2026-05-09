"use strict";
/**
 * @description A mission to automate the creation of a Gmail account with enhanced reliability.
 * @author UWAS.DEV
 * @date 2025-11-04
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
const modules_helper_1 = require("../modules-helper");
const STATS_DIRECTORY_NAME = 'accounts';
const STATS_FILE_NAME = 'GmailAccounts.json';
const PHONE_INPUT_SELECTOR = '#phoneNumberId';
const PHONE_NEXT_BUTTON_SELECTOR = '#yDmH0d > c-wiz > main > div.JYXaTc > div > div > div > div > button';
const USE_NEW_NUMBER_BUTTON_SELECTOR = '#yDmH0d > c-wiz > main > div.JYXaTc > div > div.FO2vFd > div > div > button';
/**
 * @class PhoneNumberStepNotPresentedError
 * @description A custom error used as a signal for control flow. It indicates that the phone number
 * verification step was not presented by Google, and the mission should be considered
 * a natural completion at this point.
 */
class PhoneNumberStepNotPresentedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PhoneNumberStepNotPresentedError';
    }
}
/**
 * @class VerificationAttemptsExhaustedError
 * @description A custom error used as a signal for control flow. It indicates that all attempts
 * to verify a phone number have been used, and the mission should be considered a natural
 * completion at this point, allowing for data salvage.
 */
class VerificationAttemptsExhaustedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'VerificationAttemptsExhaustedError';
    }
}
class GmailCreatorMission extends modules_helper_1.ModulesHelper.BaseMission {
    getStatsFilePath() {
        return modules_helper_1.ModulesHelper.path.join(modules_helper_1.ModulesHelper.getUserDataPath('root'), STATS_DIRECTORY_NAME, STATS_FILE_NAME);
    }
    // --- Persona Data (Turkey) ---
    static MALE_NAMES = [...new Set(['Mehmet', 'Mustafa', 'Ahmet', 'Ali', 'Hüseyin', 'Hasan', 'Murat', 'Yusuf', 'İbrahim', 'İsmail', 'Ömer', 'Ramazan', 'Osman', 'Abdullah', 'Fatih', 'Emre', 'Halil', 'Süleyman', 'Hakan', 'Adem', 'Muhammed', 'Kadir', 'Furkan', 'Mahmut', 'Burak', 'Recep', 'Serkan', 'Yasin', 'Enes', 'Metin'])];
    static FEMALE_NAMES = [...new Set(['Fatma', 'Ayşe', 'Emine', 'Hatice', 'Zeynep', 'Elif', 'Meryem', 'Merve', 'Zehra', 'Esra', 'Özlem', 'Büşra', 'Yasemin', 'Melek', 'Hülya', 'Sultan', 'Kübra', 'Dilek', 'Leyla', 'Rabia', 'Songül', 'Aysel', 'Sevim', 'Tuğba', 'Hacer', 'Fadime', 'Yağmur', 'Aynur', 'Havva', 'Ayşegül'])];
    static SURNAMES = [...new Set(['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Yıldız', 'Şahin', 'Yıldırım', 'Öztürk', 'Aydın', 'Özdemir', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Kurt', 'Koç', 'Polat', 'Şimşek', 'Korkmaz', 'Özkan', 'Yavuz', 'Çakır', 'Özcan', 'Erdoğan', 'Can', 'Acar', 'Güneş', 'Aktaş'])];
    // --- Mission State ---
    firstName = null;
    lastName = null;
    gender = null;
    username = null;
    secretKey = null;
    password = null;
    phoneNumber = null;
    verificationCode = null;
    /**
     * @property {number} totalVerificationAttempts - The total number of attempts allowed for the entire verification cycle.
     * This includes both submitting a number that gets rejected and submitting a number that times out on SMS.
     * @private
     */
    totalVerificationAttempts = 8;
    birthYear = null;
    birthMonth = null;
    birthDay = null;
    usernameGenerator = null;
    passwordGenerator = null;
    static getMetadata() {
        return {
            id: 'gmail_creator',
            title: 'Gmail Creator',
            description: 'A mission to automate the creation of a Gmail account.',
            icon: '📧',
            category: 'account',
            enabled: true,
            order: 30,
            version: '1.1.0', // Updated version
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
        this._initializePersona(); // Initialize random identity at the start
        this._logInfo('📧 Starting Gmail Creator Mission.');
        if (!this.extensionsOrchestrator) {
            const reason = 'ExtensionsOrchestrator is not available to this mission.';
            this._logError(reason);
            this.emitMissionCompleted(false, 'error', { error: reason });
            return { success: false, reason };
        }
        const startTime = Date.now();
        try {
            await this.nav.validateNavigationContext({ page });
            this._logInfo('📧 Initial navigation state asserted successfully.');
            const { completedBehaviors } = await this.interactionService.executeBehaviorLoop({
                page,
                options,
                behaviorSelector: this._selectGmailCreatorBehaviors.bind(this),
                behaviorExecutor: this._executeGmailCreatorBehavior.bind(this),
                loopType: 'gmail_creation_sequence',
                executionMode: 'sequential',
            });
            const totalTime = Date.now() - startTime;
            this._logInfo('✅ Gmail Creator Mission completed successfully.', { totalTime, completedBehaviors });
            this.emitMissionCompleted(true, 'successful_completion', { success: true, timeSpent: totalTime });
            return { success: true, reason: 'Mission completed successfully.' };
        }
        catch (error) {
            // Handle the specific, successful completion case where the phone number step is not presented.
            if (error instanceof PhoneNumberStepNotPresentedError) {
                this._logInfo(`Mission completing naturally: ${error.message}`);
                const totalTime = Date.now() - startTime;
                this.emitMissionCompleted(true, 'successful_completion', { success: true, timeSpent: totalTime, reason: error.message });
                return { success: true, reason: error.message };
            }
            // Handle the specific, successful completion case where verification attempts are exhausted.
            if (error instanceof VerificationAttemptsExhaustedError) {
                this._logWarn(`Mission completing naturally: ${error.message}. Exporting fails-cookie.`);
                const totalTime = Date.now() - startTime;
                // --- Export Logic (same as PhoneNumberStepNotPresentedError) ---
                if (!this.username || !this.password) {
                    throw new Error('Credentials (username/password) not available for export when verification attempts are exhausted.');
                }
                const credentialString = `${this.username}:${this.password}`;
                const intermediateFilename = `fails-gmail-credentials-${this.username}.json`;
                await page.evaluate(data => {
                    localStorage.setItem('fails-gmail_credentials', data);
                }, credentialString);
                await this._exportIntermediateCookie(options, intermediateFilename);
                this._logInfo(`Successfully exported intermediate fails-cookie as: ${intermediateFilename}`);
                // --- End Export Logic ---
                this.emitMissionCompleted(true, 'successful_completion', { success: true, timeSpent: totalTime, reason: error.message });
                return { success: true, reason: error.message };
            }
            // Handle user aborts
            if (error.name === 'AbortError' || error.code === 'OPERATION_ABORTED') {
                this._logWarn('Gmail Creator Mission was aborted by user.');
                this.emitMissionCompleted(false, 'user_abort', { error: error.message });
            }
            else { // Handle all other generic errors
                this._logError('Gmail Creator Mission failed.', error);
                this.emitMissionCompleted(false, 'error', { error: error.message });
            }
            throw error;
        }
        finally {
            // This block ensures that SMS verification resources are always cleaned up,
            // regardless of whether the mission succeeded, failed, or was aborted.
            this._logInfo('Gmail creator mission finished. Cleaning up SMS verification resources...');
            try {
                await this.extensionsOrchestrator.executeCapability({
                    page,
                    config: options.config,
                    capability: 'sms-verification',
                    shortcode: 'CLEANUP',
                    sessionId: this.sessionId,
                    abortSignal: options.abortSignal,
                    args: [],
                    instanceCache: this.extensionInstances,
                });
            }
            catch (cleanupError) {
                this._logError('Failed to cleanup SMS verification resources. This may lead to orphaned activations and extra costs.', { error: cleanupError.message });
            }
        }
    }
    _selectGmailCreatorBehaviors() {
        return [
            // --- Account Creation Flow ---
            { name: 'randomWait', optional: false },
            { name: 'mouseMove', optional: false },
            { name: 'clickSignIn', optional: false },
            { name: 'mouseMove', optional: false },
            { name: 'clickCreateAccount', optional: false },
            { name: 'selectPersonalUse', optional: false },
            { name: 'mouseMove', optional: false },
            { name: 'fillFirstName', optional: false },
            { name: 'fillLastName', optional: false },
            { name: 'clickCollectNameNext', optional: false },
            { name: 'mouseMove', optional: false },
            { name: 'fillBirthDay', optional: false },
            { name: 'selectBirthMonth', optional: false },
            { name: 'fillBirthYear', optional: false },
            { name: 'selectGender', optional: false },
            { name: 'clickBirthdayGenderNext', optional: false },
            { name: 'mouseMove', optional: false },
            { name: 'handleUsernameGenerationAndSubmission', optional: false },
            { name: 'mouseMove', optional: false },
            { name: 'fillPassword', optional: false },
            { name: 'clickShowPassword', optional: false },
            { name: 'clickCreatePasswordNext', optional: false },
            { name: 'mouseMove', optional: false },
            { name: 'handleFullVerificationCycle', optional: false },
            { name: 'clickNextToRecoveryEmail', optional: false },
            { name: 'clickRecoveryEmailNext', optional: false },
            { name: 'skipAddNumber', optional: false },
            { name: 'clickIAccept', optional: false },
            { name: 'saveStats', optional: false },
            { name: 'mouseMove', optional: false },
            // --- 2FA Activation Flow ---
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
            { name: 'exportCredentials', optional: false },
            { name: 'clickEnable', optional: false },
            { name: 'clickTurnOn2FA', optional: false },
            { name: 'skipPhoneNumber', optional: false },
            { name: 'confirmSkip', optional: false },
            { name: 'clickDone', optional: false },
            { name: 'exportCredentials', optional: false }, // Final export with secretKey
            { name: 'mouseMove', optional: false },
        ];
    }
    async _executeGmailCreatorBehavior(behavior, page, options) {
        this._logDebug(`Executing behavior: ${behavior}`);
        let success = false;
        switch (behavior) {
            case 'clickSignIn':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#gb > div.gb_z > a'], // Added a more robust selector
                    actions: ['hover', 'wait', 'click'],
                    maxRetries: 3,
                    expectsNavigation: true,
                });
                break;
            case 'clickCreateAccount':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#yDmH0d > c-wiz > main > div.JYXaTc > div > div.FO2vFd > div > div > div:nth-child(1) > div > button'],
                    actions: ['hover', 'click', 'wait'],
                    maxRetries: 3,
                    expectsNavigation: false, // This click opens a dropdown, no navigation
                });
                break;
            case 'selectPersonalUse':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#yDmH0d > c-wiz > main > div.JYXaTc > div > div.FO2vFd > div > div > div:nth-child(2) > div > ul > li:nth-child(2)'],
                    actions: ['wait', 'click'],
                    maxRetries: 3,
                    expectsNavigation: true,
                });
                break;
            // --- Existing Behaviors (Refactored) ---
            case 'fillFirstName':
                if (!this.firstName) {
                    throw new Error('Persona has not been initialized with a first name.');
                }
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#firstName'],
                    actions: ['hover', 'wait', 'click', 'wait', 'type', 'wait'],
                    typeText: this.firstName,
                    interactionOptions: { type: { typos: { min: 0, max: 1 } } },
                    maxRetries: 3,
                });
                break;
            case 'fillLastName':
                if (!this.lastName) {
                    throw new Error('Persona has not been initialized with a last name.');
                }
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#lastName'],
                    actions: [['tab', 'click'], 'wait', 'type', 'wait'],
                    typeText: this.lastName,
                    interactionOptions: { type: { typos: { min: 0, max: 1 } } },
                    maxRetries: 3,
                });
                break;
            case 'clickCollectNameNext':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#collectNameNext > div > button'],
                    actions: ['hover', 'wait', 'click'],
                    maxRetries: 3,
                    expectsNavigation: true,
                });
                break;
            case 'fillBirthDay': {
                if (!this.birthDay) {
                    throw new Error('Birth day not initialized in persona.');
                }
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#day'],
                    actions: ['hover', 'wait', 'click', 'wait', 'type', 'wait'],
                    typeText: this.birthDay,
                    maxRetries: 3,
                });
                break;
            }
            case 'selectBirthMonth': {
                if (!this.birthMonth) {
                    throw new Error('Birth month not initialized in persona.');
                }
                await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#month'],
                    actions: ['wait', 'click'],
                    maxRetries: 3,
                });
                await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(400, 600));
                // In Google's dropdown, month is 1-based index, but the list item is 2-based (1 is placeholder)
                const monthIndex = parseInt(this.birthMonth, 10) + 1;
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: [`#month > div > div.VfPpkd-xl07Ob-XxIAqe.VfPpkd-xl07Ob-XxIAqe-OWXEXe-tsQazb.VfPpkd-xl07Ob.VfPpkd-YPmvEd.s8kOBc.dmaMHc.VfPpkd-xl07Ob-XxIAqe-OWXEXe-uxVfW-FNFY6c-uFfGwd.VfPpkd-xl07Ob-XxIAqe-OWXEXe-FNFY6c > ul > li:nth-child(${monthIndex})`],
                    actions: ['hover', 'wait', 'click', 'wait'],
                    maxRetries: 3,
                });
                break;
            }
            case 'fillBirthYear': {
                if (!this.birthYear) {
                    throw new Error('Birth year not initialized in persona.');
                }
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#year'],
                    actions: [['tab', 'click'], 'wait', 'type', 'wait'],
                    typeText: this.birthYear,
                    maxRetries: 3,
                });
                break;
            }
            case 'selectGender': {
                if (!this.gender) {
                    throw new Error('Gender was not initialized for this persona.');
                }
                // In Google's dropdown: 2 is Female, 3 is Male
                const genderIndex = this.gender === 'female' ? 2 : 3;
                await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#gender > div > div.VfPpkd-TkwUic'],
                    actions: ['wait', 'click'],
                    maxRetries: 3,
                });
                await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(400, 600));
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: [`#gender > div > div.VfPpkd-xl07Ob-XxIAqe.VfPpkd-xl07Ob-XxIAqe-OWXEXe-tsQazb.VfPpkd-xl07Ob.VfPpkd-YPmvEd.s8kOBc.dmaMHc.VfPpkd-xl07Ob-XxIAqe-OWXEXe-uxVfW-FNFY6c-uFfGwd.VfPpkd-xl07Ob-XxIAqe-OWXEXe-FNFY6c > ul > li:nth-child(${genderIndex})`],
                    actions: ['wait', 'click', 'wait'],
                    maxRetries: 3,
                });
                break;
            }
            case 'clickBirthdayGenderNext':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#birthdaygenderNext > div > button'],
                    actions: ['hover', 'wait', 'click', 'wait'],
                    maxRetries: 3,
                    expectsNavigation: true,
                });
                break;
            case 'randomWait':
                this._logInfo('Performing random wait behavior.');
                await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(2000, 4000));
                success = true;
                break;
            case 'scroll':
                this._logInfo('Performing scroll behavior.');
                success = await modules_helper_1.ModulesHelper.Helpers.scrollPage(page, {
                    steps: { min: 15, max: 25 },
                    delay: { min: 25, max: 40 },
                    amount: { min: 200, max: 300 },
                    direction: 'random',
                });
                break;
            case 'mouseMove':
                this._logInfo('Performing mouse move behavior.');
                success = await modules_helper_1.ModulesHelper.Helpers.mouseMove(page, {
                    steps: { min: 15, max: 30 },
                    delay: { min: 10, max: 20 },
                });
                break;
            case 'handleUsernameGenerationAndSubmission': {
                const MAX_USERNAME_ATTEMPTS = 20;
                let usernameAccepted = false;
                const usernameInputSelector = 'input[name="Username"]';
                const nextButtonSelector = '#next > div > button';
                const createOwnAddressSelector = '#yDmH0d > c-wiz > main > div.UXFQgc > div > div > div > form > span > section > div > div > div.myYH1.v5IR3e.V9RXW > div.Hy62Fc > div > div:nth-child(3) > div > div.uxXgMe > div > div';
                // First, check if the username input is already visible.
                const isInputVisibleInitially = await page.locator(usernameInputSelector).isVisible({ timeout: 5000 }).catch(() => false);
                if (!isInputVisibleInitially) {
                    this._logInfo('Username input not visible. Clicking "Create your own Gmail address".');
                    const clickedOwnAddress = await this.interactionService.handleElementInteraction(page, {
                        selectors: [createOwnAddressSelector],
                        actions: ['hover', 'click'],
                        maxRetries: 3,
                    });
                    if (!clickedOwnAddress) {
                        throw new Error('Failed to click "Create your own Gmail address" to reveal the input field.');
                    }
                    await page.waitForTimeout(1000); // Wait for the input to appear
                }
                for (let i = 0; i < MAX_USERNAME_ATTEMPTS; i++) {
                    if (!this.usernameGenerator) {
                        throw new Error('UsernameGenerator is not initialized.');
                    }
                    const nextUsername = this.usernameGenerator.getNextUsername();
                    if (!nextUsername) {
                        throw new Error('UsernameGenerator has run out of combinations.');
                    }
                    this.username = nextUsername;
                    this._logInfo(`Attempting to submit username (Attempt ${i + 1}/${MAX_USERNAME_ATTEMPTS}): ${this.username}`);
                    await this.interactionService.handleElementInteraction(page, {
                        selectors: [usernameInputSelector],
                        actions: ['click', 'wait', 'type', 'wait'],
                        typeText: this.username,
                        clearFirst: true,
                        interactionOptions: { type: { typos: { min: 0, max: 2 } } },
                        maxRetries: 2,
                    });
                    await this.interactionService.handleElementInteraction(page, {
                        selectors: [nextButtonSelector],
                        actions: ['click'],
                        maxRetries: 2,
                    });
                    await page.waitForTimeout(3000);
                    const inputIsStillVisible = await page.locator(usernameInputSelector).isVisible();
                    if (!inputIsStillVisible) {
                        this._logInfo(`Username '${this.username}' was accepted as the input field is no longer visible.`);
                        usernameAccepted = true;
                        break;
                    }
                    else {
                        this._logWarn(`Username '${this.username}' was rejected (input field is still visible). Trying next combination.`);
                    }
                }
                if (!usernameAccepted) {
                    throw new Error(`Failed to find an available username after ${MAX_USERNAME_ATTEMPTS} attempts.`);
                }
                success = true;
                break;
            }
            case 'fillPassword': {
                if (!this.passwordGenerator) {
                    throw new Error('PasswordGenerator is not initialized.');
                }
                this.password = this.passwordGenerator.generate(8, 12);
                await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#passwd input', 'input[name="Passwd"]'],
                    actions: ['type', 'wait'],
                    typeText: this.password,
                    interactionOptions: { type: { typos: { min: 0, max: 2 } } },
                    maxRetries: 3,
                });
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#confirm-passwd input', 'input[name="ConfirmPasswd"]'],
                    actions: [['tab', 'click'], 'type'],
                    typeText: this.password,
                    interactionOptions: { type: { typos: { min: 0, max: 2 } } },
                    maxRetries: 3,
                });
                break;
            }
            case 'clickShowPassword':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#yDmH0d > c-wiz > main > div.UXFQgc > div > div > div > form > span > section > div > div > div > div.v8aRxf > div > div.Hy62Fc > div > div > div.uxXgMe > div > div > div.VfPpkd-YQoJzd > svg > path'],
                    actions: ['wait', 'click'],
                    maxRetries: 3,
                });
                break;
            case 'clickCreatePasswordNext':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#createpasswordNext > div > button'],
                    actions: ['wait', 'click', 'wait'],
                    maxRetries: 3,
                    expectsNavigation: true,
                });
                break;
            /**
             * Manages the entire phone and SMS verification cycle using a unified attempt counter.
             * This behavior orchestrates getting a number, submitting it, and handling failures
             * like number rejection, SMS timeout, or unexpected errors (e.g., cancellation failures).
             * It will loop until the verification is successful or the `totalVerificationAttempts` are exhausted.
             * The loop is designed to be resilient and will not exit on single-point failures, instead
             * it will log the error, decrement the attempt counter, and continue to the next attempt.
             * @param page The Playwright ModulesHelper.Page object.
             * @param options The module execution context.
             * @private
             */
            case 'handleFullVerificationCycle': {
                if (!this.extensionsOrchestrator) {
                    throw new Error('ExtensionsOrchestrator is not available for the verification cycle.');
                }
                await this._ensurePhoneNumberStepPresent(page, options);
                let cycleSuccess = false;
                while (this.totalVerificationAttempts > 0) {
                    this._logInfo(`Starting verification cycle. Attempts remaining: ${this.totalVerificationAttempts}`);
                    try {
                        // Part 1: Attempt to submit a phone number that Google accepts.
                        const numberAccepted = await this._submitAndVerifyPhoneNumber(page, options);
                        if (!numberAccepted) {
                            this.totalVerificationAttempts--;
                            this._logInfo(`A verification attempt was used due to number rejection. Attempts remaining: ${this.totalVerificationAttempts}`);
                            continue; // Continue to the next iteration of the while loop.
                        }
                        // Part 2: If number was accepted, wait for the SMS code.
                        this._logInfo('Phone number accepted. Awaiting verification code...');
                        this.verificationCode = await this.extensionsOrchestrator.executeCapability({
                            page,
                            config: options.config,
                            capability: 'sms-verification',
                            shortcode: 'GET_VERIFICATION_CODE',
                            sessionId: this.sessionId,
                            abortSignal: options.abortSignal, // Pass mission-level abort signal
                            args: [{ timeout: 60000 }], // Pass timeout preference to the extension
                            instanceCache: this.extensionInstances,
                        });
                        // Part 3: Process the result of the SMS attempt.
                        if (this.verificationCode) {
                            // --- SUCCESS PATH ---
                            this._logInfo(`Verification code received: ${this.verificationCode}. Submitting it...`);
                            await this.interactionService.handleElementInteraction(page, {
                                selectors: ['#code'],
                                actions: ['wait', 'click', 'wait', 'type'],
                                typeText: this.verificationCode,
                                maxRetries: 3,
                            });
                            this._logInfo('Verification code submitted. Marking order as complete.');
                            await this.extensionsOrchestrator.executeCapability({
                                page, config: options.config, capability: 'sms-verification', shortcode: 'COMPLETE_ORDER',
                                sessionId: this.sessionId, abortSignal: options.abortSignal, args: [], instanceCache: this.extensionInstances,
                            }).catch(completionError => {
                                this._logWarn(`Could not mark SMS order as complete. This is a non-critical error. Mission will continue. Error: ${completionError.message}`);
                            });
                            cycleSuccess = true;
                            break; // Success, exit the while loop.
                        }
                        else {
                            // --- SMS TIMEOUT FAILURE PATH (verificationCode is null) ---
                            this.totalVerificationAttempts--;
                            this._logWarn(`SMS polling timed out. Cancelling number and retrying. Attempts left: ${this.totalVerificationAttempts}`);
                            // Cancel the number since we didn't get a code for it.
                            await this.extensionsOrchestrator.executeCapability({
                                page, config: options.config, capability: 'sms-verification', shortcode: 'CANCEL_NUMBER',
                                sessionId: this.sessionId, abortSignal: options.abortSignal, args: [], instanceCache: this.extensionInstances,
                            });
                            if (this.totalVerificationAttempts > 0) {
                                this._logInfo('Attempting to get a new number for the next cycle by clicking "Use a new number".');
                                const clickedNewNumber = await this.interactionService.handleElementInteraction(page, {
                                    selectors: [USE_NEW_NUMBER_BUTTON_SELECTOR],
                                    actions: ['wait', 'click', 'wait', 'wait'],
                                    maxRetries: 3,
                                    expectsNavigation: true,
                                });
                                if (!clickedNewNumber) {
                                    throw new Error('Failed to click the "Use a new number" button after SMS timeout. Cannot retry cycle.');
                                }
                                continue; // Continue to the next iteration of the while loop.
                            }
                        }
                    }
                    catch (error) {
                        // This outer catch now only handles truly unexpected errors from the capabilities,
                        // as timeouts (null return) are handled gracefully above.
                        this.totalVerificationAttempts--;
                        this._logError(`An unexpected error occurred during the verification cycle. The mission will continue with the next attempt. Attempts left: ${this.totalVerificationAttempts}`, { errorMessage: error.message });
                        // Do not re-throw. Continue to the next iteration of the while loop.
                        continue;
                    }
                }
                if (!cycleSuccess) {
                    throw new VerificationAttemptsExhaustedError('The entire phone/SMS verification cycle failed after all attempts were used.');
                }
                success = true;
                break;
            }
            case 'clickNextToRecoveryEmail': {
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#next > div > button'],
                    actions: ['wait', 'click'],
                    maxRetries: 3,
                    expectsNavigation: true,
                });
                break;
            }
            case 'clickRecoveryEmailNext':
                success = await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#recoverySkip > div > button'],
                    actions: ['hover', 'wait', 'click', 'wait'],
                    maxRetries: 3,
                    expectsNavigation: true,
                });
                break;
            case 'skipAddNumber':
                await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#yDmH0d > c-wiz > main > div.JYXaTc > div > div > div > div > button'],
                    actions: ['hover', 'wait', 'click'],
                    maxRetries: 3,
                    // expectsNavigation: true, // DEBUG
                });
                success = true;
                break;
            case 'clickIAccept':
                await this.interactionService.handleElementInteraction(page, {
                    selectors: ['#yDmH0d > c-wiz > main > div.JYXaTc.lUWEgd > div > div.TNTaPb > div > div > button'],
                    actions: ['wait', 'hover', 'wait', 'click'],
                    maxRetries: 3,
                    expectsNavigation: true,
                });
                success = true;
                break;
            case 'saveStats':
                await this._saveCreationStats();
                success = true; // This is an optional step, so it always succeeds.
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
                if (!this.password) {
                    throw this._createError('Could not enter password, password is not set.', 'STATE_ERROR');
                }
                await this.interactionService.handleElementInteraction(page, {
                    selectors: [passwordSelector],
                    actions: ['click', 'type'],
                    typeText: this.password,
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
                    await modules_helper_1.ModulesHelper.Helpers.delay(2500);
                    const isVerifyButtonStillVisible = await page.locator(verifyButtonSelector).isVisible().catch(() => false);
                    if (!isVerifyButtonStillVisible) {
                        this._logInfo(`Verification successful on attempt ${attempt}. Proceeding to the next step.`);
                        success = true;
                        break;
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
            case 'exportCredentials': {
                if (!this.username || !this.password) {
                    throw new Error('Core credentials (username, password) not available for export.');
                }
                let credentialString;
                let intermediateFilename;
                if (this.secretKey) {
                    // If secretKey exists, include it in the export
                    this._logInfo('Exporting credentials with 2FA secret key.');
                    credentialString = `${this.username}:${this.password}:${this.secretKey}`;
                    intermediateFilename = `gmail-credentials-${this.username}-${this.password}-${this.secretKey}.json`;
                }
                else {
                    // If secretKey does not exist, export only username and password
                    this._logInfo('Exporting credentials without 2FA secret key.');
                    credentialString = `${this.username}:${this.password}`;
                    intermediateFilename = `gmail-credentials-${this.username}-${this.password}.json`;
                }
                await page.evaluate(data => {
                    // Use a consistent key in localStorage
                    localStorage.setItem('gmail_credentials_export', data.credentialString);
                }, { credentialString });
                await this._exportIntermediateCookie(options, intermediateFilename);
                success = true;
                break;
            }
            default:
                this._logWarn(`Unknown behavior selected: ${behavior}`);
        }
        if (!success) {
            // This is the critical change: throw an error to stop the loop if a behavior fails.
            throw new Error(`ModulesHelper.Behavior '${behavior}' failed after multiple retries and was not optional.`);
        }
    }
    async _exportFailsCredentials(page, options) {
        if (!this.username || !this.password) {
            throw new Error('Credentials (username/password) not available for export when phone number step is not presented.');
        }
        const credentialString = `${this.username}:${this.password}`;
        const intermediateFilename = `fails-gmail-credentials-${this.username}.json`;
        await page.evaluate(data => {
            localStorage.setItem('fails-gmail_credentials', data);
        }, credentialString);
        await this._exportIntermediateCookie(options, intermediateFilename);
        this._logInfo(`Successfully exported intermediate cookie as: ${intermediateFilename}`);
    }
    async _ensurePhoneNumberStepPresent(page, options) {
        const isPhoneInputVisible = await page.locator(PHONE_INPUT_SELECTOR).isVisible({ timeout: 10000 }).catch(() => false);
        if (isPhoneInputVisible) {
            return;
        }
        this._logWarn('Phone number input field not found. Treating as successful completion and exporting credentials.');
        await this._exportFailsCredentials(page, options);
        throw new PhoneNumberStepNotPresentedError('Mission ended with successful completion because the phone number verification step was not presented.');
    }
    /**
     * Initializes a random persona (name, surname, and gender) for the mission instance.
     * This ensures each run uses a unique identity.
     */
    _initializePersona() {
        this.gender = modules_helper_1.ModulesHelper.Helpers.getRandomElement(['male', 'female']);
        if (this.gender === 'male') {
            this.firstName = modules_helper_1.ModulesHelper.Helpers.getRandomElement(GmailCreatorMission.MALE_NAMES);
        }
        else {
            this.firstName = modules_helper_1.ModulesHelper.Helpers.getRandomElement(GmailCreatorMission.FEMALE_NAMES);
        }
        this.lastName = modules_helper_1.ModulesHelper.Helpers.getRandomElement(GmailCreatorMission.SURNAMES);
        // Initialize birth date components for the username generator
        this.birthYear = modules_helper_1.ModulesHelper.Helpers.randomBetween(1985, 2003).toString();
        this.birthMonth = modules_helper_1.ModulesHelper.Helpers.randomBetween(1, 7).toString();
        this.birthDay = modules_helper_1.ModulesHelper.Helpers.randomBetween(1, 28).toString(); // Safe for all months
        this._logInfo(`Persona initialized: ${this.firstName} ${this.lastName} (${this.gender}), born ${this.birthDay}/${this.birthMonth}/${this.birthYear}`);
        // Initialize the username generator with the full persona
        this.usernameGenerator = new modules_helper_1.ModulesHelper.Helpers.UsernameGenerator({
            firstName: this.firstName,
            lastName: this.lastName,
            birthYear: this.birthYear,
            birthMonth: this.birthMonth,
            birthDay: this.birthDay,
        });
        // Initialize the password generator with the full persona
        this.passwordGenerator = new modules_helper_1.ModulesHelper.Helpers.PasswordGenerator({
            firstName: this.firstName,
            lastName: this.lastName,
            birthYear: this.birthYear,
            birthMonth: this.birthMonth,
            birthDay: this.birthDay,
        });
    }
    /**
     * Attempts to submit a single phone number and verify if it's accepted by the service.
     * This method is responsible for a single attempt and is designed to be resilient.
     * Instead of throwing an error on failure (e.g., API error, number rejection), it logs the error
     * and returns `false`. This allows the parent `handleFullVerificationCycle` loop to manage
     * the attempt counter and decide whether to continue.
     * @param page The Playwright ModulesHelper.Page object.
     * @param options The module execution context.
     * @returns {Promise<boolean>} A promise that resolves to `true` if the number is submitted and accepted, `false` otherwise.
     * @private
     */
    async _submitAndVerifyPhoneNumber(page, options) {
        try {
            this._logInfo('Requesting a new phone number on demand.');
            this.phoneNumber = await this.extensionsOrchestrator.executeCapability({
                page,
                config: options.config,
                capability: 'sms-verification',
                shortcode: 'GET_NUMBER',
                sessionId: this.sessionId,
                abortSignal: options.abortSignal,
                args: [{}],
                instanceCache: this.extensionInstances,
            });
            if (!this.phoneNumber) {
                throw new Error('Failed to get a new phone number from the capability. This may be due to provider issues.');
            }
            this._logInfo(`Received new phone number: ${this.phoneNumber}`);
            await this.interactionService.handleElementInteraction(page, {
                selectors: [PHONE_INPUT_SELECTOR],
                actions: ['click', 'wait', 'type', 'wait'],
                typeText: this.phoneNumber,
                interactionOptions: { type: { typos: { min: 0, max: 2 } } },
                clearFirst: true,
                maxRetries: 3,
            });
            await this.interactionService.handleElementInteraction(page, {
                selectors: [PHONE_NEXT_BUTTON_SELECTOR],
                actions: ['click'],
                maxRetries: 3,
            });
            await page.waitForTimeout(10000);
            const inputIsStillVisible = await page.locator(PHONE_INPUT_SELECTOR).isVisible().catch(() => false);
            if (!inputIsStillVisible) {
                this._logInfo(`Phone number ${this.phoneNumber} was accepted by the service.`);
                this._logInfo('Requesting verification code in the background...');
                return true;
            }
            this._logWarn(`Phone number ${this.phoneNumber} was rejected. Cancelling and retrying...`);
            await this.extensionsOrchestrator.executeCapability({
                page,
                config: options.config,
                capability: 'sms-verification',
                shortcode: 'CANCEL_NUMBER',
                sessionId: this.sessionId,
                abortSignal: options.abortSignal,
                args: [{}],
                instanceCache: this.extensionInstances,
            });
            this.phoneNumber = null;
            return false;
        }
        catch (error) {
            this._logError('An unexpected error occurred during the phone number submission attempt.', error);
            if (this.phoneNumber) {
                this._logInfo(`Attempting to cancel active number due to error: ${this.phoneNumber}`);
                this.extensionsOrchestrator.executeCapability({
                    page,
                    config: options.config,
                    capability: 'sms-verification',
                    shortcode: 'CANCEL_NUMBER',
                    sessionId: this.sessionId,
                    abortSignal: options.abortSignal,
                    args: [{}],
                    instanceCache: this.extensionInstances,
                }).catch(cancelError => {
                    this._logError('Failed to initiate phone number cancellation during error handling. This may incur costs.', cancelError);
                });
                this.phoneNumber = null;
            }
            return false;
        }
    }
    /**
     * @description Saves the successfully created account credentials to a statistics file.
     * This operation is designed to be resilient and will not throw an error if it fails,
     * only log a warning, to avoid interrupting the main mission flow.
     * @private
     */
    async _saveCreationStats() {
        if (!this.username || !this.password) {
            this._logWarn('Cannot save creation stats because username or password is not set.');
            return;
        }
        const credentialLine = `${this.username}:${this.password}`;
        this._logInfo(`Saving creation stats: ${credentialLine}`);
        try {
            const statsFilePath = this.getStatsFilePath();
            await modules_helper_1.ModulesHelper.fsPromises.mkdir(modules_helper_1.ModulesHelper.path.dirname(statsFilePath), { recursive: true });
            let stats = [];
            try {
                const data = await modules_helper_1.ModulesHelper.fsPromises.readFile(statsFilePath, 'utf-8');
                stats = JSON.parse(data);
                if (!Array.isArray(stats)) {
                    this._logWarn('Stats file is not a valid JSON array. Resetting it.');
                    stats = [];
                }
            }
            catch (error) {
                if (error.code === 'ENOENT') {
                    this._logInfo('Stats file not found. A new one will be created.');
                    stats = [];
                }
                else {
                    throw error; // Re-throw other read/parse errors to be caught by the outer block.
                }
            }
            stats.push(credentialLine);
            // To prevent duplicates, convert to a Set and back to an array
            const uniqueStats = [...new Set(stats)];
            await modules_helper_1.ModulesHelper.fsPromises.writeFile(statsFilePath, JSON.stringify(uniqueStats, null, 2));
            this._logInfo('Successfully saved creation stats.');
        }
        catch (error) {
            this._logError('Failed to save creation stats file.', { error });
            // Do not re-throw, as this is a non-critical operation.
        }
    }
}
exports.default = GmailCreatorMission;
//# sourceMappingURL=gmail-creator-mission.js.map
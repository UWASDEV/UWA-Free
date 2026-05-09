"use strict";
/**
 * @description Provides an evidence-based reference mission for developers who want to build modules.
 *              This mission documents and demonstrates the verified mission-facing APIs exposed by the project:
 *              browser interactions, navigation helpers, extension capabilities, shortcode processing, persona and
 *              credential generation, screenshots, user-data artifacts, intermediate cookie export, and error handling.
 *
 *              Note: This mission does not cover all module capabilities. Navigator-only flows, extension UI/static APIs,
 *              certain ModulesHelper exports, and some navigation/base protected helpers are out of scope here.
 *
 *              All examples in this file are intentionally explicit. Risky or stateful capabilities such as SMS orders,
 *              2FA activation, CAPTCHA detection, screenshots, artifact writes, cookie export, and destructive navigation
 *              are disabled by default and require opt-in configuration. Site-specific selectors are examples only and
 *              must be adapted by real modules.
 *
 *              WARNING: Enabling both the 2FA and intermediate cookie export demos may result in the 2FA
 *              secret being written to the export filename. Use this pattern cautiously.
 *
 *              Extension-only developer APIs such as `getSettingsUI()` and `getInfoUI()` are not mission APIs. They are
 *              proven in extension modules such as `fivesimsmsverificator`, `grizzlysmsverificator`, and `authenticator`.
 *              Missions demonstrate metadata, default configuration, schema, validation, lifecycle, and runtime behavior.
 *
 * @author UWAS.DEV
 * @date 2025-10-17
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
const modules_helper_1 = require("../modules-helper");
const SCREENSHOTS_DIRECTORY_NAME = 'screenshots';
const EXAMPLE_ARTIFACTS_DIRECTORY_NAME = 'example-mission';
const EXAMPLE_WRITE_FILE_NAME = 'example-write.json';
const EXAMPLE_READ_FILE_NAME = 'example-read.json';
const MAX_USERNAME_ATTEMPTS = 5;
const MAX_2FA_ATTEMPTS = 5;
const DEFAULT_SMS_TIMEOUT_MS = 60000;
/**
 * @class ExampleMission
 * @description A self-contained developer reference mission. It keeps its examples deterministic where safe and uses
 *              explicit opt-in flags for examples that write files, navigate, modify account state, or call extensions.
 *
 * @remarks ModulesHelper facade reference for exports used in this file:
 * - `ModulesHelper.BaseMission<TOptions>`: base class for mission modules. It provides lifecycle execution,
 *   `this.nav`, `this.captcha`, `this.extensionsOrchestrator`, `_createError()`, `_createFatalError()`,
 *   `_createValidationError()`, `processShortcode()`, and `_exportIntermediateCookie()`.
 * - `ModulesHelper.Page`: Playwright `Page` type used by mission `_run()` and interaction examples.
 * - `ModulesHelper.Behavior`: `{ name: string; optional: boolean }`, consumed by `executeBehaviorLoop()`.
 * - `ModulesHelper.IModuleExecutionContext`: execution context containing `config`, `settings`, optional `targetURL`,
 *   optional `abortSignal`, optional `watchdogFeed`, optional `intermediateCookieExporter`, and optional
 *   `importedCookieFilename`.
 * - `ModulesHelper.Helpers.delay(ms: number): Promise<void>` waits for a non-negative finite millisecond duration.
 * - `ModulesHelper.Helpers.waitWithFeed(duration: number, feedCallback?: () => void, feedInterval?: number): Promise<void>`
 *   waits while periodically feeding a watchdog callback.
 * - `ModulesHelper.Helpers.safeExecute<T>(fn: () => Promise<T>, defaultValue?: T | null): Promise<T | null>` returns
 *   `defaultValue` if `fn` throws.
 * - `ModulesHelper.Helpers.retryWithBackoff<T>(fn: () => Promise<T>, maxRetries?: number, baseDelay?: number): Promise<T>`
 *   retries an async function with exponential backoff and throws the final error on failure.
 * - `ModulesHelper.Helpers.scrollPage(page, options?)`, `mouseMove(page, options?)`, and `moveToPoint(context, x, y, options?)`
 *   provide low-level human-like scrolling and mouse movement. Scroll options include `steps`, `delay`, `amount`,
 *   `direction`, `pauseChance`, and `pauseDuration`. Mouse options include `steps`, `delay`, `pauseChance`, and
 *   `pauseDuration`.
 * - `ModulesHelper.Helpers.randomDelay(min?: number, max?: number): Promise<void>` waits for a random duration.
 * - `ModulesHelper.Helpers.randomBetween(min: number, max: number, allowFloat?: boolean): number` returns a random number.
 * - `ModulesHelper.Helpers.getRandomElement<T>(arr: T[]): T | undefined` selects one array item.
 * - `ModulesHelper.Helpers.shuffleArray<T>(arr: T[]): T[]` returns a shuffled copy.
 * - `ModulesHelper.Helpers.removeDuplicates<T>(arr: T[]): T[]` returns a new array containing unique values.
 * - `ModulesHelper.Helpers.generateRandomNumericString(length: number): string` returns random decimal digits.
 * - `ModulesHelper.Helpers.transliterateString(input: string): string` replaces supported locale characters with Latin forms.
 * - `ModulesHelper.Helpers.isSameDomain(urlOrHost1?: string | null, urlOrHost2?: string | null): boolean` compares domains.
 * - `ModulesHelper.Helpers.extractData<T>(page, schema): Promise<T[]>` extracts structured DOM data. The schema contains
 *   `containerSelector`, `itemSchema`, and optional `waitForSelectorOptions`.
 * - `ModulesHelper.Helpers.filterVisibleElements(locators): Promise<Locator[]>` returns visible Playwright locators.
 * - `ModulesHelper.Helpers.UsernameGenerator({ firstName, lastName, birthYear, birthMonth, birthDay })` exposes
 *   `getNextUsername(): string | null`.
 * - `ModulesHelper.Helpers.PasswordGenerator({ firstName, lastName, birthYear, birthMonth, birthDay })` exposes
 *   `generate(minLength: number, maxLength: number): string`.
 * - `ModulesHelper.fs`, `ModulesHelper.fsPromises`, and `ModulesHelper.path` expose Node file-system and path helpers.
 * - `ModulesHelper.getUserDataPath('root')` returns the user-data root used for module-owned artifacts.
 */
class ExampleMission extends modules_helper_1.ModulesHelper.BaseMission {
    /** Demo male names used by the persona generator example. */
    static MALE_NAMES = ['John', 'Ahmet', 'Mert', 'Alex'];
    /** Demo female names used by the persona generator example. */
    static FEMALE_NAMES = ['Jane', 'Ayse', 'Elif', 'Maya'];
    /** Demo surnames used by the persona generator example. */
    static SURNAMES = ['Doe', 'Yilmaz', 'Smith', 'Kaya'];
    /** Persona first name generated by `_initializePersonaExample()`. */
    firstName = null;
    /** Persona last name generated by `_initializePersonaExample()`. */
    lastName = null;
    /** Persona gender generated by `_initializePersonaExample()`. */
    gender = null;
    /** Persona birth year generated by `_initializePersonaExample()`. */
    birthYear = null;
    /** Persona birth month generated by `_initializePersonaExample()`. */
    birthMonth = null;
    /** Persona birth day generated by `_initializePersonaExample()`. */
    birthDay = null;
    /** Stateful username generator initialized from persona data. */
    usernameGenerator = null;
    /** Stateful password generator initialized from persona data. */
    passwordGenerator = null;
    /** Last username accepted or generated by the username example. */
    username = null;
    /** Last password generated by the password example. */
    password = null;
    /** Secret key read from the page or supplied by configuration. */
    secretKey = null;
    /** Phone number returned by the active SMS extension. */
    phoneNumber = null;
    /** Verification code returned by the active SMS extension. */
    verificationCode = null;
    /** Last screenshot path produced by the screenshot example. */
    lastScreenshotPath = null;
    /** Structured link data extracted by the DOM extraction helper example. */
    extractedLinks = [];
    /**
     * @method getMetadata
     * @description Returns static metadata consumed by the module registry and renderer.
     */
    static getMetadata() {
        return {
            id: 'example_mission', // snake_case
            title: 'Example Mission',
            description: 'Developer reference mission for verified mission-facing capabilities.',
            icon: '🦾',
            category: 'comprehensive',
            enabled: true,
            order: 100,
            version: '1.0.0',
            features: ['interactions', 'navigation', 'extensions', '2fa', 'sms', 'screenshots', 'artifacts'],
        };
    }
    /**
     * @method getDefaultConfig
     * @description Returns safe defaults. Risky demos are disabled until explicitly configured by a developer.
     */
    static getDefaultConfig() {
        return {
            ...super.getDefaultConfig(),
            enableSmsLifecycleDemo: false,
            enable2faLifecycleDemo: false,
            enableScreenshotDemo: false,
            enableUserArtifactDemo: false,
            enableIntermediateCookieExportDemo: false,
            enableCaptchaDemo: false,
            enableDestructiveNavigationDemo: false,
            enableFormInteractionDemo: false,
            enableConditionalClickDemo: false,
            demoSecretKey: '',
            demoSecretReadSelector: '[data-example-secret]',
            demoTotpInputSelector: 'input[name="totp"], #totpPin, #c0',
            demoTotpVerifyButtonSelector: 'button[type="submit"], #totpNext',
            demoPhoneInputSelector: 'input[type="tel"], #phoneNumberId',
            demoPhoneSubmitSelector: 'button[type="submit"]',
            demoSmsCodeInputSelector: 'input[name="code"], #code',
            demoUsernameInputSelector: 'input[name="Username"], input[name="username"]',
            demoUsernameSubmitSelector: 'button[type="submit"]',
            demoPasswordInputSelector: 'input[name="Passwd"], input[type="password"]',
            demoConfirmPasswordInputSelector: 'input[name="ConfirmPasswd"], input[type="password"]',
            demoFirstNameInputSelector: 'input[name="firstName"], #firstName',
            demoLastNameInputSelector: 'input[name="lastName"], #lastName',
            demoBirthDayInputSelector: 'input[name="day"], #day',
            demoBirthMonthInputSelector: 'input[name="month"], #month',
            demoBirthYearInputSelector: 'input[name="year"], #year',
            demoGenderSelector: 'select[name="gender"], #gender',
            demoNavigationLinkSelector: 'a[href]',
            demoExpectedNavigationUrl: '',
            demo2faEnableSelector: '',
            demo2faSkipPhoneSelector: '',
            demo2faConfirmSkipSelector: '',
            demo2faDoneSelector: '',
        };
    }
    /**
     * @method getConfigSchema
     * @description Returns a JSON-schema-like object, matching proven mission examples such as `cookie-generator`.
     *              Note: The base contract `BaseMission.getConfigSchema()` mentions a Zod schema. This reference
     *              mission demonstrates the actual current implementation pattern using JSON-schema properties.
     */
    getConfigSchema() {
        return {
            type: 'object',
            properties: {
                enableSmsLifecycleDemo: { type: 'boolean', default: false },
                enable2faLifecycleDemo: { type: 'boolean', default: false },
                enableScreenshotDemo: { type: 'boolean', default: false },
                enableUserArtifactDemo: { type: 'boolean', default: false },
                enableIntermediateCookieExportDemo: { type: 'boolean', default: false },
                enableCaptchaDemo: { type: 'boolean', default: false },
                enableDestructiveNavigationDemo: { type: 'boolean', default: false },
                enableFormInteractionDemo: { type: 'boolean', default: false },
                enableConditionalClickDemo: { type: 'boolean', default: false },
                demoSecretKey: { type: 'string' },
            },
            additionalProperties: true,
        };
    }
    /**
     * @method validate
     * @description Performs concrete validation for options used by opt-in examples.
     */
    validate(config) {
        this._validateOptionalString(config.demoSecretKey, 'demoSecretKey');
        this._validateOptionalString(config.demoExpectedNavigationUrl, 'demoExpectedNavigationUrl');
        this._validateOptionalSelector(config.demoPhoneInputSelector, 'demoPhoneInputSelector');
        this._validateOptionalSelector(config.demoSmsCodeInputSelector, 'demoSmsCodeInputSelector');
        this._validateOptionalSelector(config.demo2faEnableSelector, 'demo2faEnableSelector');
        this._validateOptionalSelector(config.demo2faSkipPhoneSelector, 'demo2faSkipPhoneSelector');
        this._validateOptionalSelector(config.demo2faConfirmSkipSelector, 'demo2faConfirmSkipSelector');
        this._validateOptionalSelector(config.demo2faDoneSelector, 'demo2faDoneSelector');
        this._validateOptInDependencies(config);
        return Promise.resolve();
    }
    /**
     * @method _run
     * @description Demonstrates the mission lifecycle: context validation, state assertions, behavior loop, result emission,
     *              graceful abort preservation, and navigation error enhancement.
     */
    async _run(page, options) {
        this._logInfo('🦾 Starting comprehensive example mission on target page.');
        if (!this.enabled) {
            this.emitMissionCompleted(true, 'successful_completion', { reason: 'disabled' });
            return { success: true, reason: 'disabled' };
        }
        const startTime = Date.now();
        const expectedState = this._buildExpectedState(options.targetURL);
        try {
            await this.nav.validateNavigationContext({ page, abortSignal: options.abortSignal });
            await this.nav.assertNavigationState(page, expectedState);
            const { completedBehaviors } = await this.interactionService.executeBehaviorLoop({
                page,
                options,
                behaviorSelector: this._selectTargetPageBehaviors.bind(this),
                behaviorExecutor: this._executeTargetPageBehavior.bind(this),
                loopType: 'comprehensive_example_reference',
                executionMode: 'sequential',
            });
            await this.nav.assertNavigationState(page, expectedState);
            const duration = Date.now() - startTime;
            const data = this._buildResultData(duration, completedBehaviors, options.targetURL);
            this.emitMissionCompleted(true, 'successful_completion', data);
            return { success: true, reason: 'successful_completion', data };
        }
        catch (error) {
            if (error.name === 'AbortError' || error.code === 'OPERATION_ABORTED') {
                this.emitMissionCompleted(false, 'user_abort', { error: error.message });
                throw error;
            }
            const enhancedError = await this.nav.handleNavigationError(error, {
                operation: 'comprehensive_example_execution',
                missionType: this.getModuleType(),
                targetURL: options.targetURL,
            });
            this.emitMissionCompleted(false, 'error', {
                error: enhancedError.message,
                targetURL: options.targetURL,
            });
            throw enhancedError;
        }
    }
    /**
     * @method _selectTargetPageBehaviors
     * @description Returns mandatory behaviors so reference examples are not skipped by optional selection logic.
     */
    _selectTargetPageBehaviors() {
        return [
            { name: 'timingHelpers', optional: false },
            { name: 'scrollAndMouseHelpers', optional: false },
            { name: 'basicInteractionActions', optional: false },
            { name: 'advancedInteractionOptions', optional: false },
            { name: 'personaAndCredentials', optional: false },
            { name: 'conditionalUi', optional: false },
            { name: 'dataExtraction', optional: false },
            { name: 'navigationHelpers', optional: false },
            { name: 'shortcodeAnd2faCode', optional: false },
            { name: 'smsLifecycle', optional: false },
            { name: 'twoFactorLifecycle', optional: false },
            { name: 'screenshot', optional: false },
            { name: 'userArtifact', optional: false },
            { name: 'intermediateCookieExport', optional: false },
            { name: 'errorHandling', optional: false },
        ];
    }
    /**
     * @method _executeTargetPageBehavior
     * @description Dispatches behavior names to JSDoc-documented private examples.
     */
    async _executeTargetPageBehavior(behavior, page, options) {
        switch (behavior) {
            case 'timingHelpers':
                await this._demonstrateTimingHelpers(options);
                break;
            case 'scrollAndMouseHelpers':
                await this._demonstrateScrollAndMouseHelpers(page);
                break;
            case 'basicInteractionActions':
                await this._demonstrateBasicInteractionActions(page, options);
                break;
            case 'advancedInteractionOptions':
                await this._demonstrateAdvancedInteractionOptions(page, options);
                break;
            case 'personaAndCredentials':
                await this._demonstratePersonaAndCredentials(page);
                break;
            case 'conditionalUi':
                await this._demonstrateConditionalUi(page);
                break;
            case 'dataExtraction':
                await this._demonstrateDataExtraction(page);
                break;
            case 'navigationHelpers':
                await this._demonstrateNavigationHelpers(page, options);
                break;
            case 'shortcodeAnd2faCode':
                await this._demonstrateShortcodeAnd2faCode(page, options);
                break;
            case 'smsLifecycle':
                await this._demonstrateSmsLifecycle(page, options);
                break;
            case 'twoFactorLifecycle':
                await this._demonstrateTwoFactorLifecycle(page, options);
                break;
            case 'screenshot':
                await this._demonstrateScreenshot(page);
                break;
            case 'userArtifact':
                await this._demonstrateUserArtifactPersistence();
                break;
            case 'intermediateCookieExport':
                await this._demonstrateIntermediateCookieExport(options);
                break;
            case 'errorHandling':
                await this._demonstrateErrorHandling();
                break;
            default:
                throw this._createError(`Unknown example behavior: ${behavior}`, 'UNKNOWN_BEHAVIOR');
        }
    }
    /**
     * @method _demonstrateTimingHelpers
     * @description Demonstrates timing helpers plus direct data-helper calls documented in the ModulesHelper facade section.
     */
    async _demonstrateTimingHelpers(options) {
        const randomNumeric = modules_helper_1.ModulesHelper.Helpers.generateRandomNumericString(4);
        const transliterated = modules_helper_1.ModulesHelper.Helpers.transliterateString('İşğöçü');
        const shuffled = modules_helper_1.ModulesHelper.Helpers.shuffleArray(['alpha', 'beta', 'gamma']);
        const sameDomain = modules_helper_1.ModulesHelper.Helpers.isSameDomain('https://www.example.com/a', 'example.com');
        this._logDebug('Data helper examples completed.', {
            randomNumericLength: randomNumeric.length,
            transliterated,
            shuffledCount: shuffled.length,
            sameDomain,
        });
        await modules_helper_1.ModulesHelper.Helpers.delay(modules_helper_1.ModulesHelper.Helpers.randomBetween(100, 200));
        await modules_helper_1.ModulesHelper.Helpers.waitWithFeed(100, options.watchdogFeed, 50);
        await modules_helper_1.ModulesHelper.Helpers.safeExecute(() => Promise.resolve('safe-value'), 'safe-default-value');
        await modules_helper_1.ModulesHelper.Helpers.retryWithBackoff(() => Promise.resolve('retry-value'), 0, 100);
    }
    /**
     * @method _demonstrateScrollAndMouseHelpers
     * @description Demonstrates low-level scroll and mouse helpers without requiring site-specific selectors.
     */
    async _demonstrateScrollAndMouseHelpers(page) {
        await modules_helper_1.ModulesHelper.Helpers.scrollPage(page, {
            steps: { min: 5, max: 8 },
            delay: { min: 10, max: 20 },
            amount: { min: 100, max: 160 },
            direction: 'random',
        });
        await modules_helper_1.ModulesHelper.Helpers.mouseMove(page, { steps: { min: 5, max: 10 }, delay: { min: 5, max: 10 } });
        await modules_helper_1.ModulesHelper.Helpers.moveToPoint(page, 25, 25, { steps: { min: 5, max: 8 } });
        await modules_helper_1.ModulesHelper.Helpers.randomDelay(50, 100);
    }
    /**
     * @method _demonstrateBasicInteractionActions
     * @description Demonstrates all verified `InteractionAction` values: hover, click, select, focus, type, wait, tab,
     *              enter, and read. Missing selectors and action failures safely skip through false returns from
     *              `handleElementInteraction` instead of forcing mission failures, in order to allow the demo loop
     *              to continue.
     */
    async _demonstrateBasicInteractionActions(page, options) {
        await this.interactionService.handleElementInteraction(page, {
            selectors: ['h1', 'h2', 'h3', 'p'],
            actions: ['hover', 'wait', 'click', 'wait', 'select', 'wait', 'read'],
            clickCount: 3,
            onRead: text => this._logInfo('Read text from page.', { text }),
            waitDelay: { min: 50, max: 100 },
            watchdogFeed: options.watchdogFeed,
        });
        await this.interactionService.handleElementInteraction(page, {
            selectors: ['textarea[data-example-input]', 'textarea[name="example"]'],
            actions: ['focus', 'wait', 'type', 'wait', 'enter'],
            typeText: 'Reference mission typing example.',
            clearFirst: true,
            maxRetries: 1,
            interactionOptions: { type: { delay: { min: 40, max: 80 }, typos: { min: 0, max: 1 } } },
        });
        await this.interactionService.handleElementInteraction(page, {
            selectors: ['input[data-example-tab-target]', 'textarea[data-example-tab-target]'],
            actions: ['focus', 'wait', 'tab'],
            maxRetries: 1,
        });
    }
    /**
     * @method _demonstrateAdvancedInteractionOptions
     * @description Demonstrates action groups, iframe targeting, element filters, and optional navigation verification.
     */
    async _demonstrateAdvancedInteractionOptions(page, options) {
        await this.interactionService.handleElementInteraction(page, {
            frameSelectors: ['iframe[name="account"]', 'iframe'],
            selectors: ['a[href]', 'button'],
            actions: [['hover', 'focus'], 'wait', ['read', 'wait']],
            maxRetries: 2,
            filter: async (element) => {
                const text = await element.textContent();
                return Boolean(text?.trim());
            },
            onRead: text => this._logDebug('Advanced read result.', { text }),
        });
        if (this.config.enableDestructiveNavigationDemo && this.config.demoExpectedNavigationUrl) {
            await this.interactionService.handleElementInteraction(page, {
                selectors: [this.config.demoNavigationLinkSelector || 'a[href]'],
                actions: ['hover', 'click'],
                expectsNavigation: true,
                navigationVerification: { expectedUrl: this.config.demoExpectedNavigationUrl, timeout: 10000 },
                maxRetries: 1,
                watchdogFeed: options.watchdogFeed,
            });
        }
    }
    /**
     * @method _demonstratePersonaAndCredentials
     * @description Demonstrates persona generation, username generation, username rejection checks, password generation,
     *              password field filling, and confirmation field filling.
     */
    async _demonstratePersonaAndCredentials(page) {
        this._initializePersonaExample();
        this._generateCredentialExamples();
        if (!this.config.enableFormInteractionDemo) {
            this._logDebug('Skipping selector-driven persona form interactions because enableFormInteractionDemo is false.');
            return;
        }
        await this._fillPersonaFields(page);
        await this._submitUsernameCandidateIfConfigured(page);
        await this._fillPasswordFieldsIfConfigured(page);
    }
    /**
     * @method _demonstrateConditionalUi
     * @description Demonstrates visible-if-present and state-check patterns used by verification missions.
     */
    async _demonstrateConditionalUi(page) {
        if (this.config.enableConditionalClickDemo) {
            await this._clickIfVisible(page, '[data-example-conditional-click]');
        }
        const inputStillVisible = await page.locator(this.config.demoUsernameInputSelector || 'input[name="username"]').isVisible().catch(() => false);
        this._logDebug('Conditional UI input visibility check completed.', { inputStillVisible });
    }
    /**
     * @method _demonstrateDataExtraction
     * @description Demonstrates `filterVisibleElements()` and `extractData<T>()` for structured DOM reads.
     */
    async _demonstrateDataExtraction(page) {
        const locators = await page.locator('a[href]').all();
        const visibleLinks = await modules_helper_1.ModulesHelper.Helpers.filterVisibleElements(locators);
        this._logDebug('Visible link locator count.', { count: visibleLinks.length });
        // Demonstrates extracting a single structured item from the page body.
        this.extractedLinks = await modules_helper_1.ModulesHelper.Helpers.extractData(page, {
            containerSelector: 'body',
            itemSchema: {
                title: { selector: 'a[href]', attribute: 'textContent' },
                href: { selector: 'a[href]', attribute: 'href' },
            },
        });
    }
    /**
     * @method _demonstrateNavigationHelpers
     * @description Demonstrates navigation state checks and optional navigation-after-action usage.
     */
    async _demonstrateNavigationHelpers(page, options) {
        const state = await this.nav.checkNavigationState(page);
        this._logDebug('Navigation state checked.', { url: state.url, title: state.title });
        await this.nav.assertNavigationState(page, { bodyShouldContain: ['body'] });
        if (this.config.enableCaptchaDemo) {
            await this._detectCaptchaChallenge(page);
        }
        if (this.config.enableDestructiveNavigationDemo && this.config.demoNavigationLinkSelector) {
            await this.nav.navigateAfterAction(page, () => page.locator(this.config.demoNavigationLinkSelector || 'a[href]').first().click(), { settings: options.settings, watchdogFeed: options.watchdogFeed, abortSignal: options.abortSignal });
        }
    }
    /**
     * @method _demonstrateShortcodeAnd2faCode
     * @description Demonstrates protected `processShortcode()` and direct `2fa-authentication:GET_CODE` capability calls.
     */
    async _demonstrateShortcodeAnd2faCode(page, options) {
        const configuredSecret = this._getConfiguredSecret();
        if (!configuredSecret) {
            this._logDebug('Skipping shortcode and TOTP demo because no demo secret is configured.');
            return;
        }
        const shortcodeText = `[2fa-authentication:GET_CODE:${configuredSecret}]`;
        const processed = await this.processShortcode(page, options, shortcodeText);
        this._logInfo('Processed TOTP shortcode text without logging the generated code.', { processedTextLength: processed.length });
        if (this.extensionsOrchestrator) {
            const code = await this.extensionsOrchestrator.executeCapability({
                page,
                config: options.config,
                capability: '2fa-authentication',
                shortcode: 'GET_CODE',
                sessionId: this.sessionId,
                abortSignal: options.abortSignal,
                args: [configuredSecret],
                instanceCache: this.extensionInstances,
            });
            this._logInfo('Generated TOTP code through extension capability without logging the code.', { codeLength: String(code).length });
        }
    }
    /**
     * @method _demonstrateSmsLifecycle
     * @description Demonstrates SMS lifecycle calls. Disabled by default because SMS providers can be paid/stateful.
     */
    async _demonstrateSmsLifecycle(page, options) {
        if (!this.config.enableSmsLifecycleDemo) {
            this._logDebug('Skipping SMS lifecycle demo because it is disabled.');
            return;
        }
        if (!this.extensionsOrchestrator) {
            throw this._createError('ExtensionsOrchestrator is required for SMS lifecycle demo.', 'MISSING_DEPENDENCY');
        }
        try {
            this.phoneNumber = await this._executeSmsCapability(page, options, 'GET_NUMBER', [{}]);
            if (!this.phoneNumber) {
                throw this._createError('SMS provider did not return a phone number.', 'SMS_NUMBER_UNAVAILABLE');
            }
            await this._typeAndSubmitPhoneNumber(page);
            const rejected = await page.locator(this.config.demoPhoneInputSelector || '#phoneNumberId').isVisible().catch(() => false);
            if (rejected) {
                await this._executeSmsCapability(page, options, 'CANCEL_NUMBER', []);
                return;
            }
            this.verificationCode = await this._executeSmsCapability(page, options, 'GET_VERIFICATION_CODE', [{ timeout: DEFAULT_SMS_TIMEOUT_MS }]);
            if (!this.verificationCode) {
                await this._executeSmsCapability(page, options, 'CANCEL_NUMBER', []);
                return;
            }
            await this._typeSmsCode(page);
            await this._executeSmsCapability(page, options, 'COMPLETE_ORDER', []);
        }
        finally {
            await this._tryProviderSpecificSmsCleanup(page, options);
        }
    }
    /**
     * @method _demonstrateTwoFactorLifecycle
     * @description Demonstrates the 2FA activation pattern. Disabled by default because it can modify account security.
     */
    async _demonstrateTwoFactorLifecycle(page, options) {
        if (!this.config.enable2faLifecycleDemo) {
            this._logDebug('Skipping 2FA lifecycle demo because it is disabled.');
            return;
        }
        await this._readSecretFromPage(page);
        await this._enterAndVerifyTotpWithRetry(page, options);
        await this._demonstrateTwoFactorPostVerificationControls(page);
        await this._exportTwoFactorCookiePattern(options);
    }
    /**
     * @method _demonstrateScreenshot
     * @description Demonstrates full-page screenshot capture to the user-data screenshots directory.
     */
    async _demonstrateScreenshot(page) {
        if (!this.config.enableScreenshotDemo) {
            this._logDebug('Skipping screenshot demo because it is disabled.');
            return;
        }
        const screenshotDir = this._getScreenshotDirectoryPath();
        if (!modules_helper_1.ModulesHelper.fs.existsSync(screenshotDir)) {
            modules_helper_1.ModulesHelper.fs.mkdirSync(screenshotDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filepath = modules_helper_1.ModulesHelper.path.join(screenshotDir, `example-mission-${timestamp}.png`);
        await page.screenshot({ path: filepath, fullPage: true });
        this.lastScreenshotPath = filepath;
        this._logInfo('Screenshot saved.', { filepath });
    }
    /**
     * @method _demonstrateUserArtifactPersistence
     * @description Demonstrates separate module-owned JSON read and write artifact examples under the user-data root.
     */
    async _demonstrateUserArtifactPersistence() {
        if (!this.config.enableUserArtifactDemo) {
            this._logDebug('Skipping user artifact demo because it is disabled.');
            return;
        }
        try {
            const readFilePath = this._getReadFilePath();
            const writeFilePath = this._getWriteFilePath();
            await modules_helper_1.ModulesHelper.fsPromises.mkdir(modules_helper_1.ModulesHelper.path.dirname(writeFilePath), { recursive: true });
            const artifactData = await this._readExampleArtifactFile(readFilePath);
            artifactData.runs += 1;
            artifactData.updatedAt = new Date().toISOString();
            if (this.username) {
                artifactData.generatedUsernames = modules_helper_1.ModulesHelper.Helpers.removeDuplicates([...artifactData.generatedUsernames, this.username]);
            }
            if (this.lastScreenshotPath) {
                artifactData.screenshots = modules_helper_1.ModulesHelper.Helpers.removeDuplicates([...artifactData.screenshots, this.lastScreenshotPath]);
            }
            await modules_helper_1.ModulesHelper.fsPromises.writeFile(writeFilePath, JSON.stringify(artifactData, null, 2), 'utf-8');
        }
        catch (error) {
            this._logWarn('User artifact persistence failed; this is non-critical for the mission.', { error: error.message });
        }
    }
    /**
     * @method _demonstrateIntermediateCookieExport
     * @description Demonstrates mission-triggered intermediate cookie export through the execution context.
     */
    async _demonstrateIntermediateCookieExport(options) {
        if (!this.config.enableIntermediateCookieExportDemo) {
            this._logDebug('Skipping intermediate cookie export demo because it is disabled.');
            return;
        }
        const sourceName = options.importedCookieFilename || 'example-cookie.json';
        const safeUsername = this.username || 'no-username';
        const filename = `example-${safeUsername}-${sourceName}`;
        await this._exportIntermediateCookie(options, filename);
    }
    /**
     * @method _demonstrateErrorHandling
     * @description Demonstrates standard, fatal, and validation error construction without throwing them in a normal run.
     */
    _demonstrateErrorHandling() {
        const standardError = this._createError('Example recoverable error object.', 'EXAMPLE_RECOVERABLE');
        const fatalError = this._createFatalError('Example fatal error object.', 'EXAMPLE_FATAL');
        const validationError = this._createValidationError('exampleField', 'exampleValue', 'example_rule', 'Example validation error object.');
        this._logDebug('Constructed example errors without throwing.', {
            standardCode: standardError.code,
            fatalCode: fatalError.code,
            validationName: validationError.name,
        });
    }
    /**
     * @method _initializePersonaExample
     * @description Creates a local persona and initializes username/password generators from verified constructor options.
     */
    _initializePersonaExample() {
        this.gender = modules_helper_1.ModulesHelper.Helpers.getRandomElement(['male', 'female']) || 'male';
        const names = this.gender === 'female' ? ExampleMission.FEMALE_NAMES : ExampleMission.MALE_NAMES;
        this.firstName = modules_helper_1.ModulesHelper.Helpers.getRandomElement(names) || 'John';
        this.lastName = modules_helper_1.ModulesHelper.Helpers.getRandomElement(ExampleMission.SURNAMES) || 'Doe';
        this.birthYear = modules_helper_1.ModulesHelper.Helpers.randomBetween(1985, 2003).toString();
        this.birthMonth = modules_helper_1.ModulesHelper.Helpers.randomBetween(1, 12).toString();
        this.birthDay = modules_helper_1.ModulesHelper.Helpers.randomBetween(1, 28).toString();
        this.usernameGenerator = new modules_helper_1.ModulesHelper.Helpers.UsernameGenerator({
            firstName: this.firstName,
            lastName: this.lastName,
            birthYear: this.birthYear,
            birthMonth: this.birthMonth,
            birthDay: this.birthDay,
        });
        this.passwordGenerator = new modules_helper_1.ModulesHelper.Helpers.PasswordGenerator({
            firstName: this.firstName,
            lastName: this.lastName,
            birthYear: this.birthYear,
            birthMonth: this.birthMonth,
            birthDay: this.birthDay,
        });
    }
    /**
     * @method _fillPersonaFields
     * @description Demonstrates filling first name, last name, birth date fields, and a gender control when present.
     */
    async _fillPersonaFields(page) {
        await this._typeIfAvailable(page, this.config.demoFirstNameInputSelector, this.firstName);
        await this._typeIfAvailable(page, this.config.demoLastNameInputSelector, this.lastName);
        await this._typeIfAvailable(page, this.config.demoBirthDayInputSelector, this.birthDay);
        await this._typeIfAvailable(page, this.config.demoBirthMonthInputSelector, this.birthMonth);
        await this._typeIfAvailable(page, this.config.demoBirthYearInputSelector, this.birthYear);
        await this._clickIfVisible(page, this.config.demoGenderSelector || 'select[name="gender"]');
    }
    /**
     * @method _generateCredentialExamples
     * @description Demonstrates username candidate generation and persona-consistent password generation without page writes.
     */
    _generateCredentialExamples() {
        if (this.usernameGenerator) {
            this.username = this.usernameGenerator.getNextUsername();
        }
        if (this.passwordGenerator) {
            this.password = this.passwordGenerator.generate(8, 12);
        }
    }
    /**
     * @method _submitUsernameCandidateIfConfigured
     * @description Demonstrates username rejection checks only when form interaction examples are explicitly enabled.
     */
    async _submitUsernameCandidateIfConfigured(page) {
        if (!this.usernameGenerator) {
            return;
        }
        for (let attempt = 1; attempt <= MAX_USERNAME_ATTEMPTS; attempt += 1) {
            const candidate = this.usernameGenerator.getNextUsername();
            if (!candidate) {
                return;
            }
            this.username = candidate;
            await this._typeIfAvailable(page, this.config.demoUsernameInputSelector, candidate);
            await this._clickIfVisible(page, this.config.demoUsernameSubmitSelector || '[data-example-username-submit]');
            await modules_helper_1.ModulesHelper.Helpers.delay(250);
            const stillVisible = await page.locator(this.config.demoUsernameInputSelector || 'input[name="username"]').isVisible().catch(() => false);
            if (!stillVisible) {
                return;
            }
        }
    }
    /**
     * @method _fillPasswordFieldsIfConfigured
     * @description Demonstrates password and confirmation typing only when form interaction examples are explicitly enabled.
     */
    async _fillPasswordFieldsIfConfigured(page) {
        await this._typeIfAvailable(page, this.config.demoPasswordInputSelector, this.password);
        await this._typeIfAvailable(page, this.config.demoConfirmPasswordInputSelector, this.password);
    }
    /**
     * @method _typeIfAvailable
     * @description Types into the first matching selector if it exists; otherwise safely skips.
     */
    async _typeIfAvailable(page, selector, text) {
        if (!selector || !text) {
            return;
        }
        await this.interactionService.handleElementInteraction(page, {
            selectors: [selector],
            actions: ['click', 'wait', 'type'],
            typeText: text,
            clearFirst: true,
            maxRetries: 1,
            interactionOptions: { type: { delay: { min: 40, max: 80 }, typos: { min: 0, max: 1 } } },
        });
    }
    /**
     * @method _clickIfVisible
     * @description Clicks a selector only when Playwright reports it as visible.
     */
    async _clickIfVisible(page, selector) {
        const visible = await page.locator(selector).first().isVisible().catch(() => false);
        if (!visible) {
            return false;
        }
        return this.interactionService.handleElementInteraction(page, {
            selectors: [selector],
            actions: ['hover', 'wait', 'click'],
            maxRetries: 1,
        });
    }
    /**
     * @method _executeSmsCapability
     * @description Calls the active extension that provides `sms-verification`.
     */
    async _executeSmsCapability(page, options, shortcode, args) {
        if (!this.extensionsOrchestrator) {
            throw this._createError('ExtensionsOrchestrator is not available.', 'MISSING_DEPENDENCY');
        }
        const result = await this.extensionsOrchestrator.executeCapability({
            page,
            config: options.config,
            capability: 'sms-verification',
            shortcode,
            sessionId: this.sessionId,
            abortSignal: options.abortSignal,
            args,
            instanceCache: this.extensionInstances,
        });
        return result;
    }
    /**
     * @method _typeAndSubmitPhoneNumber
     * @description Types the acquired phone number and submits it through configured selectors.
     */
    async _typeAndSubmitPhoneNumber(page) {
        await this._typeIfAvailable(page, this.config.demoPhoneInputSelector, this.phoneNumber);
        await this._clickIfVisible(page, this.config.demoPhoneSubmitSelector || 'button[type="submit"]');
    }
    /**
     * @method _typeSmsCode
     * @description Types the SMS verification code into the configured code field.
     */
    async _typeSmsCode(page) {
        await this._typeIfAvailable(page, this.config.demoSmsCodeInputSelector, this.verificationCode);
    }
    /**
     * @method _tryProviderSpecificSmsCleanup
     * @description Attempts provider-specific `CLEANUP` and treats unsupported shortcode failures as non-critical.
     */
    async _tryProviderSpecificSmsCleanup(page, options) {
        try {
            await this._executeSmsCapability(page, options, 'CLEANUP', []);
        }
        catch (error) {
            this._logWarn('Provider-specific SMS cleanup failed or is unsupported; continuing safely.', { error: error.message });
        }
    }
    /**
     * @method _readSecretFromPage
     * @description Reads and normalizes a TOTP secret from the page or falls back to configured secret text.
     */
    async _readSecretFromPage(page) {
        if (this.config.demoSecretReadSelector) {
            await this.interactionService.handleElementInteraction(page, {
                selectors: [this.config.demoSecretReadSelector],
                actions: ['read'],
                onRead: text => {
                    this.secretKey = text.replace(/\s/g, '');
                },
                maxRetries: 1,
            });
        }
        this.secretKey = this.secretKey || this._getConfiguredSecret();
    }
    /**
     * @method _enterAndVerifyTotpWithRetry
     * @description Generates TOTP codes through the authenticator extension and retries while verification remains visible.
     */
    async _enterAndVerifyTotpWithRetry(page, options) {
        if (!this.secretKey || !this.extensionsOrchestrator) {
            throw this._createError('2FA demo requires a secret key and ExtensionsOrchestrator.', 'MISSING_DEPENDENCY');
        }
        const inputSelector = this.config.demoTotpInputSelector || '#totpPin';
        const verifySelector = this.config.demoTotpVerifyButtonSelector || '#totpNext';
        for (let attempt = 1; attempt <= MAX_2FA_ATTEMPTS; attempt += 1) {
            const code = await this.extensionsOrchestrator.executeCapability({
                page,
                config: options.config,
                capability: '2fa-authentication',
                shortcode: 'GET_CODE',
                sessionId: this.sessionId,
                abortSignal: options.abortSignal,
                args: [this.secretKey],
                instanceCache: this.extensionInstances,
            });
            await this._typeIfAvailable(page, inputSelector, code);
            await this._clickIfVisible(page, verifySelector);
            await modules_helper_1.ModulesHelper.Helpers.delay(1000);
            const stillVisible = await page.locator(verifySelector).isVisible().catch(() => false);
            if (!stillVisible) {
                return;
            }
        }
        throw this._createError('Failed to verify 2FA code after retries.', 'VERIFICATION_FAILED');
    }
    /**
     * @method _demonstrateTwoFactorPostVerificationControls
     * @description Demonstrates optional enable, skip-phone, confirm-skip, and done clicks from proven 2FA flows.
     */
    async _demonstrateTwoFactorPostVerificationControls(page) {
        await this._clickOptionalSelector(page, this.config.demo2faEnableSelector, '2FA enable control');
        await this._clickOptionalSelector(page, this.config.demo2faSkipPhoneSelector, '2FA skip-phone control');
        await this._clickOptionalSelector(page, this.config.demo2faConfirmSkipSelector, '2FA confirm-skip control');
        await this._clickOptionalSelector(page, this.config.demo2faDoneSelector, '2FA done control');
    }
    /**
     * @method _exportTwoFactorCookiePattern
     * @description Demonstrates the 2FA secret-bearing intermediate cookie export pattern when cookie export is enabled.
     *              WARNING: This pattern exports sensitive data (the secret key) in the filename and should only be used
     *              if intentionally required by the project's artifact lifecycle.
     */
    async _exportTwoFactorCookiePattern(options) {
        if (!this.config.enableIntermediateCookieExportDemo || !this.secretKey) {
            return;
        }
        const sourceName = options.importedCookieFilename || 'example-2fa-cookie.json';
        const baseName = sourceName.replace(/\.json$/u, '');
        await this._exportIntermediateCookie(options, `${baseName}-${this.secretKey}.json`);
    }
    /**
     * @method _clickOptionalSelector
     * @description Clicks an optional configured selector and logs whether that optional pattern was skipped.
     */
    async _clickOptionalSelector(page, selector, label) {
        if (!selector) {
            this._logDebug(`Skipping optional ${label} because no selector is configured.`);
            return;
        }
        await this._clickIfVisible(page, selector);
    }
    /**
     * @method _readExampleArtifactFile
     * @description Reads example-read.json and recovers to a safe default if the file is missing or malformed.
     */
    async _readExampleArtifactFile(filePath) {
        try {
            const raw = await modules_helper_1.ModulesHelper.fsPromises.readFile(filePath, 'utf-8');
            return JSON.parse(raw);
        }
        catch {
            return { runs: 0, generatedUsernames: [], screenshots: [], updatedAt: new Date(0).toISOString() };
        }
    }
    /**
     * @method _buildExpectedState
     * @description Builds a conservative navigation assertion state for the current target page.
     *              Safely handles invalid URLs by returning a base expected state.
     */
    _buildExpectedState(targetURL) {
        const expectedState = {
            bodyShouldContain: ['body'],
        };
        if (targetURL) {
            try {
                expectedState.hostnameShouldMatch = new URL(targetURL).hostname;
            }
            catch (error) {
                this._logWarn(`Invalid targetURL provided to _buildExpectedState: ${targetURL}`, { error: error.message });
            }
        }
        return expectedState;
    }
    /**
     * @method _buildResultData
     * @description Collects non-sensitive summary data for the mission result and completion metadata.
     */
    _buildResultData(duration, completedBehaviors, targetURL) {
        return {
            duration,
            completedBehaviors,
            targetURL,
            username: this.username,
            screenshotPath: this.lastScreenshotPath,
            extractedLinksCount: this.extractedLinks.length,
        };
    }
    /**
     * @method _getConfiguredSecret
     * @description Returns a normalized configured secret or null when no secret is configured.
     */
    _getConfiguredSecret() {
        const secret = this.config.demoSecretKey?.replace(/\s/g, '') || '';
        return secret.length > 0 ? secret : null;
    }
    /**
     * @method _getScreenshotDirectoryPath
     * @description Resolves the user-data screenshot directory used by the screenshot example.
     */
    _getScreenshotDirectoryPath() {
        return modules_helper_1.ModulesHelper.path.join(modules_helper_1.ModulesHelper.getUserDataPath('root'), SCREENSHOTS_DIRECTORY_NAME);
    }
    /**
     * @method _getWriteFilePath
     * @description Resolves the module-owned example-write.json artifact path under the user-data root.
     */
    _getWriteFilePath() {
        return modules_helper_1.ModulesHelper.path.join(modules_helper_1.ModulesHelper.getUserDataPath('root'), EXAMPLE_ARTIFACTS_DIRECTORY_NAME, EXAMPLE_WRITE_FILE_NAME);
    }
    /**
     * @method _getReadFilePath
     * @description Resolves the module-owned example-read.json artifact path under the user-data root.
     */
    _getReadFilePath() {
        return modules_helper_1.ModulesHelper.path.join(modules_helper_1.ModulesHelper.getUserDataPath('root'), EXAMPLE_ARTIFACTS_DIRECTORY_NAME, EXAMPLE_READ_FILE_NAME);
    }
    /**
     * @method _validateOptionalString
     * @description Validates optional string fields without requiring them for safe default runs.
     */
    _validateOptionalString(value, field) {
        if (value !== undefined && typeof value !== 'string') {
            throw this._createValidationError(field, value, 'optional_string', `${field} must be a string when provided.`);
        }
    }
    /**
     * @method _validateOptionalSelector
     * @description Validates optional selector values as non-empty strings when present.
     */
    _validateOptionalSelector(value, field) {
        if (value === undefined || value === '') {
            return;
        }
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw this._createValidationError(field, value, 'optional_non_empty_string', `${field} must be a non-empty selector.`);
        }
    }
    /**
     * @method _validateOptInDependencies
     * @description Validates explicit opt-in demos that require additional configuration.
     */
    _validateOptInDependencies(config) {
        if (config.enableDestructiveNavigationDemo && !config.demoExpectedNavigationUrl) {
            throw this._createValidationError('demoExpectedNavigationUrl', config.demoExpectedNavigationUrl, 'required_when_navigation_demo_enabled', 'demoExpectedNavigationUrl is required when enableDestructiveNavigationDemo is true.');
        }
        if (config.enable2faLifecycleDemo && !config.demoSecretKey && !config.demoSecretReadSelector) {
            throw this._createValidationError('demoSecretKey', config.demoSecretKey, 'required_when_2fa_demo_enabled', 'Either demoSecretKey or demoSecretReadSelector is required when enable2faLifecycleDemo is true.');
        }
    }
    /**
     * @method shouldComplete
     * @description This reference mission completes after one deterministic behavior loop.
     */
    shouldComplete(_context = {}) {
        return true;
    }
}
exports.default = ExampleMission;
//# sourceMappingURL=example-mission.js.map
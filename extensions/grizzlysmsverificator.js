"use strict";
/**
 * @description Grizzly SMS verification extension. Uses a statistics-based, multi-country, concurrent approach for robust and fast number acquisition.
 * @author UWAS.DEV
 * @date 2025-11-12
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
const modules_helper_1 = require("../modules-helper");
const API_BASE_URL = 'https://api.grizzlysms.com/stubs/handler_api.php';
const STATS_DIRECTORY_NAME = 'stats';
const STATS_FILE_NAME = 'GrizzlySmsVerificatorStats.json';
// #endregion
// #region Internal Helper Classes
/**
 * @class GrizzlyStatsManager
 * @description Manages SMS delivery statistics for different countries to optimize number acquisition.
 * This class is intended for internal use by the GrizzlySmsVerificator extension.
 */
class GrizzlyStatsManager {
    stats = {};
    logger;
    constructor() {
        this.logger = new modules_helper_1.ModulesHelper.Logger();
        this.loadStats().catch(err => this.logger.error('Failed to initialize GrizzlySMS stats', { error: err }));
    }
    getStatsFilePath() {
        return modules_helper_1.ModulesHelper.path.join(modules_helper_1.ModulesHelper.getUserDataPath('root'), STATS_DIRECTORY_NAME, STATS_FILE_NAME);
    }
    /**
     * @description Loads statistics from the JSON file. Creates the directory/file if it doesn't exist.
     * @private
     */
    async loadStats() {
        try {
            const statsFilePath = this.getStatsFilePath();
            await modules_helper_1.ModulesHelper.fsPromises.mkdir(modules_helper_1.ModulesHelper.path.dirname(statsFilePath), { recursive: true });
            const data = await modules_helper_1.ModulesHelper.fsPromises.readFile(statsFilePath, 'utf-8');
            this.stats = JSON.parse(data);
            this.logger.info('GrizzlySMS stats loaded successfully.');
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                this.logger.warn('Stats file not found. A new one will be created on the first update.');
                this.stats = {};
            }
            else {
                this.logger.error('Failed to load GrizzlySMS stats file.', { error });
            }
        }
    }
    /**
     * @description Saves the current statistics to the JSON file.
     * @private
     */
    async saveStats() {
        try {
            const statsFilePath = this.getStatsFilePath();
            await modules_helper_1.ModulesHelper.fsPromises.mkdir(modules_helper_1.ModulesHelper.path.dirname(statsFilePath), { recursive: true });
            await modules_helper_1.ModulesHelper.fsPromises.writeFile(statsFilePath, JSON.stringify(this.stats, null, 2));
        }
        catch (error) {
            this.logger.error('Failed to save GrizzlySMS stats file.', { error });
        }
    }
    /**
     * @description Updates the SMS delivery statistics for a given country.
     * @param {string} country - The country code.
     * @param {boolean} isSuccess - Whether the SMS was successfully received.
     */
    async updateSmsDeliveryStats(country, isSuccess) {
        this.ensureStatExists(country);
        const countryStat = this.stats[country];
        countryStat.smsRequests += 1;
        if (isSuccess) {
            countryStat.successfulDeliveries += 1;
        }
        countryStat.smsDeliveryRate = (countryStat.successfulDeliveries / countryStat.smsRequests) * 100;
        this.logger.info(`SMS delivery stats updated for country ${country}`, { newStats: countryStat });
        await this.saveStats();
    }
    /**
     * @description Updates the number acceptance/rejection statistics for a given country.
     * @param {string} country - The country code.
     * @param {boolean} isAccepted - Whether the number was accepted by the target service.
     */
    async updateAcceptanceStats(country, isAccepted) {
        this.ensureStatExists(country);
        const countryStat = this.stats[country];
        if (isAccepted) {
            countryStat.acceptedNumbers += 1;
        }
        else {
            countryStat.rejectedNumbers += 1;
        }
        const totalDecided = countryStat.acceptedNumbers + countryStat.rejectedNumbers;
        if (totalDecided > 0) {
            countryStat.acceptanceRate = (countryStat.acceptedNumbers / totalDecided) * 100;
        }
        this.logger.info(`Acceptance stats updated for country ${country}`, { newStats: countryStat });
        await this.saveStats();
    }
    /**
     * @description Ensures a statistics object exists for a country, creating it if not.
     * @param {string} country - The country code.
     * @private
     */
    ensureStatExists(country) {
        if (!this.stats[country]) {
            this.stats[country] = {
                smsRequests: 0,
                successfulDeliveries: 0,
                smsDeliveryRate: 0,
                acceptedNumbers: 0,
                rejectedNumbers: 0,
                acceptanceRate: 0,
            };
        }
    }
    /**
     * @description Returns a list of top-performing countries based on SMS delivery rate.
     * @param {number} count - The number of countries to return.
     * @param {string[]} exclude - A list of country codes to exclude.
     * @returns {string[]} A sorted list of country codes.
     */
    getTopPerformingCountries(count, exclude = []) {
        return Object.entries(this.stats)
            .filter(([country]) => !exclude.includes(country))
            .sort(([, a], [, b]) => b.smsDeliveryRate - a.smsDeliveryRate)
            .slice(0, count)
            .map(([country]) => country);
    }
    /**
     * @description Selects a random country from a given pool.
     * @param {string[]} pool - The list of country codes to choose from.
     * @param {string[]} exclude - A list of country codes to exclude.
     * @returns {string | null} A random country code or null if the pool is empty.
     */
    getRandomCountry(pool, exclude = []) {
        const availableCountries = pool.filter(c => c && !exclude.includes(c));
        if (availableCountries.length === 0) {
            return null;
        }
        const randomIndex = Math.floor(Math.random() * availableCountries.length);
        return availableCountries[randomIndex];
    }
}
/**
 * @class NumberPoolManager
 * @description Handles concurrent number fetching, pooling, and providing numbers on demand.
 * This class is intended for internal use by the GrizzlySmsVerificator extension.
 */
class NumberPoolManager {
    owner;
    unclaimedActivations = [];
    isFilling = false;
    fillPoolAbortController = null;
    eventEmitter = new modules_helper_1.ModulesHelper.EventEmitter();
    logger;
    constructor(owner) {
        this.owner = owner;
        this.logger = new modules_helper_1.ModulesHelper.Logger();
        this.eventEmitter.setMaxListeners(20); // Set a higher limit for concurrent missions
    }
    /**
     * @description Requests a number from the pool. If the pool is full, it provides one immediately.
     * If the pool is empty, it triggers the pool-filling mechanism and waits for a number to become available. This method acts as the "consumer".
     * @param {Partial<IGrizzlySmsVerificatorOptions>} options - Configuration options for number acquisition.
     * @returns {Promise<IActiveActivation>} A promise that resolves with an activation.
     */
    async requestNumber(options) {
        // If the pool has numbers, provide one immediately.
        if (this.unclaimedActivations.length > 0) {
            this.logger.info(`Providing number from existing pool. Pool size: ${this.unclaimedActivations.length - 1}`);
            return this.unclaimedActivations.shift();
        }
        // If the pool is empty, wait for a new number.
        this.logger.info('Pool is empty. Waiting for a new number.');
        // Trigger the background pool filling process (if not already running).
        this.fillPool(options).catch(err => this.logger.error('Background pool fill failed', { error: err }));
        const waitTimeout = 120000; // 120 seconds timeout.
        let listener;
        try {
            // Promise that resolves when a number is added to the pool.
            const numberPromise = new Promise(resolve => {
                listener = () => {
                    // When the 'numberAdded' signal is received, the pool should have a number.
                    if (this.unclaimedActivations.length > 0) {
                        this.logger.info(`Number arrived in pool. Fulfilling waiting request. Pool size: ${this.unclaimedActivations.length - 1}`);
                        resolve(this.unclaimedActivations.shift());
                    }
                };
                // Listen for the signal, not for data.
                this.eventEmitter.once('numberAdded', listener);
            });
            // Promise that rejects after the timeout.
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(this.owner.createError('Timeout waiting for a number from the pool.', 'TIMEOUT_ERROR'));
                }, waitTimeout);
            });
            // Race between the number arrival and the timeout.
            return await Promise.race([numberPromise, timeoutPromise]);
        }
        finally {
            // Cleanup: always remove the listener to prevent memory leaks.
            if (listener) {
                this.eventEmitter.removeListener('numberAdded', listener);
            }
        }
    }
    /**
     * @description Fills the pool with new numbers from the API in the background. This method acts as the "producer".
     * It finds numbers and adds them to the pool, then emits a 'numberAdded' signal.
     * @param {Partial<IGrizzlySmsVerificatorOptions>} options - Configuration options.
     * @private
     */
    async fillPool(options) {
        if (this.isFilling) {
            this.logger.info('Pool filling is already in progress.');
            return;
        }
        this.isFilling = true;
        this.logger.info('Starting to fill the number pool.');
        // Abort any previous controller and create a new one for this fill cycle.
        this.fillPoolAbortController?.abort();
        this.fillPoolAbortController = new AbortController();
        const { signal } = this.fillPoolAbortController;
        try {
            const finalOptions = { ...this.owner.config, ...options };
            const { service, countryPool, maxPrice, firstCountry } = finalOptions;
            if (!service) {
                throw this.owner.createError('GrizzlySMS Service is not configured.', 'CONFIGURATION_ERROR');
            }
            const countriesToTry = this.determineCountriesToTry(firstCountry, countryPool);
            if (countriesToTry.length === 0) {
                throw this.owner.createError('No countries available to try.', 'CONFIGURATION_ERROR');
            }
            this.logger.info(`Pool will be filled by trying the following countries: [${countriesToTry.join(', ')}]`);
            const promises = countriesToTry.map(country => this.tryGetNumberForCountry(country, 60000, maxPrice, signal));
            // Concurrently add numbers to the pool as they are found
            for (const promise of promises) {
                promise.then(activation => {
                    // Ensure the fill process hasn't been aborted since this promise was created
                    if (activation && !signal.aborted) {
                        this.unclaimedActivations.push(activation);
                        this.logger.info(`Added number from ${activation.country} to the pool. New size: ${this.unclaimedActivations.length}`);
                        this.eventEmitter.emit('numberAdded');
                    }
                }).catch(error => {
                    if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
                        this.logger.warn('A number acquisition attempt failed during pool filling.', { error: error.message });
                    }
                });
            }
            await Promise.allSettled(promises);
        }
        catch (error) {
            if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
                this.logger.error('An error occurred during pool filling.', { error });
            }
        }
        finally {
            this.isFilling = false;
            this.fillPoolAbortController = null;
        }
    }
    /**
     * @description Determines the list of countries to try based on configuration and statistics.
     * @param {string} firstCountry - The country to prioritize.
     * @param {string} countryPool - A comma-separated list of countries to use.
     * @returns {string[]} An array of country codes to try.
     * @private
     */
    determineCountriesToTry(firstCountry, countryPool) {
        const pool = countryPool ? countryPool.split(',').map(c => c.trim()) : [];
        const countriesToTry = [];
        if (firstCountry) {
            countriesToTry.push(firstCountry);
        }
        const topCountries = this.owner.statsManager.getTopPerformingCountries(3, countriesToTry);
        countriesToTry.push(...topCountries);
        const needed = 10 - countriesToTry.length;
        if (needed > 0) {
            for (let i = 0; i < needed; i++) {
                const randomCountry = this.owner.statsManager.getRandomCountry(pool, countriesToTry);
                if (randomCountry) {
                    countriesToTry.push(randomCountry);
                }
                else {
                    break;
                }
            }
        }
        return [...new Set(countriesToTry)].filter(c => c);
    }
    /**
     * @description Attempts to acquire a single phone number from a specific country by polling the API.
     * @param {string} country - The country code to try.
     * @param {number} timeout - The polling timeout in milliseconds.
     * @param {string} maxPrice - The maximum price for the number.
     * @returns {Promise<IActiveActivation>} A promise that resolves with the activation details.
     * @private
     */
    async tryGetNumberForCountry(country, timeout, maxPrice, signal) {
        const pollingInterval = 5000;
        const startTime = Date.now();
        this.logger.info(`Polling for number in ${country || 'any'} for ${timeout / 1000}s`);
        while (Date.now() - startTime < timeout) {
            if (signal.aborted) {
                this.logger.info(`Number polling for country ${country} was aborted.`);
                return null;
            }
            try {
                const response = await this.owner.apiRequest({
                    action: 'getNumber',
                    service: this.owner.config.service,
                    country,
                    maxPrice,
                }, signal);
                if (response.status === 'ACCESS_NUMBER' && response.values.length >= 2) {
                    const [id, number] = response.values;
                    this.logger.info(`Acquired number from ${country}. Activation ID: ${id}`);
                    return { id, number: `+${number}`, country };
                }
                if (response.status === 'NO_NUMBERS') {
                    const elapsedTime = Math.round((Date.now() - startTime) / 1000);
                    this.logger.info(`No numbers available yet for ${country}. Elapsed: ${elapsedTime}s. Retrying...`);
                }
                else {
                    this.logger.warn(`Unexpected status for ${country}: ${response.status}`);
                }
            }
            catch (error) {
                if (error.name === 'CanceledError' || error.name === 'AbortError') {
                    this.logger.info(`API request for country ${country} was aborted.`);
                    return null;
                }
                this.logger.error(`Error polling for number in ${country}`, { error: error.message });
            }
            await modules_helper_1.ModulesHelper.delay(pollingInterval);
        }
        this.logger.warn(`Timeout for country ${country}`);
        return null;
    }
    /**
     * @description Cancels all unclaimed activations in the pool.
     */
    async cleanup() {
        // Abort any ongoing background searches immediately.
        if (this.isFilling && this.fillPoolAbortController) {
            this.logger.info('Aborting active number pool filling process.');
            this.fillPoolAbortController.abort();
        }
        this.logger.info(`Cleaning up ${this.unclaimedActivations.length} unclaimed activations from the pool.`);
        const cancellationPromises = this.unclaimedActivations.map(activation => this.owner.cancelActivation(activation.id));
        await Promise.allSettled(cancellationPromises);
        this.unclaimedActivations = [];
    }
}
// #endregion
/**
 * @class GrizzlySmsVerificator
 * @description Main extension class. Orchestrates statistics, number pooling, and the verification lifecycle.
 * @version 2.2.0
 */
class GrizzlySmsVerificator extends modules_helper_1.ModulesHelper.BaseExtension {
    /** @property {IActiveActivation | null} activeActivation - The activation currently assigned to a mission. */
    activeActivation = null;
    /** @property {boolean} isVerificationAttempted - Flag to track if a verification code has been requested for the current number. */
    isVerificationAttempted = false;
    /** @property {Map<string, NodeJS.Timeout>} pendingCancellations - Tracks activations scheduled for a delayed cancellation. */
    pendingCancellations = new Map();
    /** @property {GrizzlyStatsManager} statsManager - Manages country performance statistics. */
    statsManager;
    /** @property {NumberPoolManager} numberPoolManager - Manages the pool of available numbers. */
    numberPoolManager;
    constructor(options = {}) {
        super(options);
        this.statsManager = new GrizzlyStatsManager();
        this.numberPoolManager = new NumberPoolManager(this);
    }
    static getDefaultConfig() {
        return {
            apiKey: '',
            service: '',
            firstCountry: '',
            countryPool: '',
            maxPrice: '',
            enabled: true,
        };
    }
    static getMetadata() {
        return {
            id: 'grizzlysmsverification',
            title: 'Grizzly SMS Verification',
            description: 'Automates SMS verification using a statistics-based, multi-country, concurrent strategy.',
            icon: '🐻',
            category: 'Verification',
            enabled: true,
            sessionbased: true,
            order: 11,
            version: '2.2.0',
            capabilities: ['sms-verification'],
        };
    }
    validate(_config) {
        return Promise.resolve();
    }
    getConfigSchema() {
        return modules_helper_1.ModulesHelper.z.object({
            apiKey: modules_helper_1.ModulesHelper.z.string().min(1, { message: 'GrizzlySMS API Key is required.' }),
            service: modules_helper_1.ModulesHelper.z.string().min(1, { message: 'GrizzlySMS Service is required.' }),
            firstCountry: modules_helper_1.ModulesHelper.z.string().optional(),
            countryPool: modules_helper_1.ModulesHelper.z.string().optional(),
            maxPrice: modules_helper_1.ModulesHelper.z.string().refine(val => !val || !isNaN(parseFloat(val)), { message: 'Max Price must be a number.' }).optional(),
        });
    }
    static getSettingsUI() {
        const defaultConfig = this.getDefaultConfig();
        return [
            {
                type: 'password',
                name: 'apiKey',
                label: 'API Key',
                placeholder: 'Enter your GrizzlySMS API Key',
                defaultValue: defaultConfig.apiKey,
            },
            {
                type: 'text',
                name: 'service',
                label: 'Service',
                placeholder: 'e.g., go, tg, ds',
                defaultValue: defaultConfig.service,
            },
            {
                type: 'text',
                name: 'firstCountry',
                label: 'First Country',
                placeholder: 'e.g., 77, 48, 0 for any',
                defaultValue: defaultConfig.firstCountry,
            },
            {
                type: 'text',
                name: 'countryPool',
                label: 'Country Pool (Comma-separated)',
                placeholder: 'e.g., 77,48,1,44,34',
                defaultValue: defaultConfig.countryPool,
            },
            {
                type: 'text',
                name: 'maxPrice',
                label: 'Max Price',
                placeholder: 'e.g., 0.5',
                defaultValue: defaultConfig.maxPrice,
            },
        ];
    }
    static getInfoUI() {
        return `
            <h4>How to use in a Missions or Navigator:</h4>
            <p>This extension is controlled by calling its methods via the <code>ExtensionsOrchestrator</code>. You can use the following shortcodes:</p>
            <ul>
                <li><strong>Get Phone Number:</strong> <code>GET_NUMBER</code></li>
                <li><strong>Get Verification Code:</strong> <code>GET_VERIFICATION_CODE</code></li>
                <li><strong>Cancel Current Number:</strong> <code>CANCEL_NUMBER</code></li>
                <li><strong>Complete Order:</strong> <code>COMPLETE_ORDER</code></li>
                <li><strong>Cleanup All Resources:</strong> <code>CLEANUP</code></li>
            </ul>
            <p><strong>Example Usage in a Mission or Navigator:</strong></p>
            <pre><code>
            const phoneNumber = await this.extensionsOrchestrator.executeCapability({
              capability: 'sms-verification',
              shortcode: 'GET_NUMBER',
              args: [{ firstCountry: '48' }] // Optional override
            });
            </code></pre>
        `;
    }
    /**
     * @description Entry point for executing shortcode commands.
     * @param {ModulesHelper.Page} page - The Playwright page object.
     * @param {ModulesHelper.IExtensionExecutionContext} options - The execution context.
     * @returns {Promise<any>}
     * @protected
     */
    _run(page, options) {
        const { shortcode, args } = options;
        switch (shortcode) {
            case 'GET_NUMBER': {
                const getNumberOptions = args[0] || {};
                return this.getNumber(page, getNumberOptions);
            }
            case 'GET_VERIFICATION_CODE': {
                const verificationOptions = args[0] || {};
                return this.getVerificationCode(page, verificationOptions);
            }
            case 'CANCEL_NUMBER':
                return this.cancelNumber(page);
            case 'COMPLETE_ORDER':
                return this.completeOrder(page);
            case 'CLEANUP':
                return this.cleanup(page);
            default:
                return Promise.reject(this._createError(`Shortcode '${shortcode}' is not supported.`, 'UNSUPPORTED_SHORTCODE'));
        }
    }
    /**
     * @description A public wrapper for the protected _createError method, allowing helper classes to create standardized errors.
     * @param {string} message - The error message.
     * @param {string} code - The error code.
     * @param {any} [context] - Additional context for the error.
     * @returns {Error} A standardized error object.
     */
    createError(message, code, context) {
        return this._createError(message, code, context);
    }
    /**
     * @description Performs a request to the GrizzlySMS API.
     * @param {Record<string, any>} params - The API parameters.
     * @returns {Promise<{ status: string; values: string[] }>} The API response.
     * @public
     */
    async apiRequest(params, signal) {
        if (!this.config.apiKey) {
            throw this._createError('GrizzlySMS API Key is not configured.', 'CONFIGURATION_ERROR');
        }
        const allParams = {
            // eslint-disable-next-line camelcase
            api_key: this.config.apiKey,
            ...params,
        };
        try {
            const config = {
                method: 'get',
                url: API_BASE_URL,
                params: allParams,
                signal,
            };
            const response = await modules_helper_1.ModulesHelper.axios(config);
            const responseText = response.data;
            if (!responseText) {
                throw this._createError('GrizzlySMS API returned an empty response.', 'API_ERROR');
            }
            const parts = responseText.split(':');
            const status = parts[0];
            const values = parts.slice(1);
            this._logInfo(`GrizzlySMS API Raw Response: "${responseText}"`, { status, values: values.join(',') });
            if (['BAD_KEY', 'ERROR_SQL', 'BAD_ACTION', 'BAD_SERVICE', 'SERVICE_UNAVAILABLE_REGION'].includes(status)) {
                throw this._createError(`GrizzlySMS API Error: ${status}`, 'API_ERROR', { response: responseText });
            }
            return { status, values };
        }
        catch (error) {
            if (error.context?.isCustomError) {
                throw error;
            }
            const errorData = error.response?.data || error.message;
            this._logError('GrizzlySMS API request failed', { error: errorData, params });
            throw this._createError(`GrizzlySMS API Request Failed: ${errorData}`, 'API_REQUEST_FAILED', { originalError: error });
        }
    }
    /**
     * @description Acquires a phone number by requesting it from the NumberPoolManager.
     * @param {ModulesHelper.Page} _page - The Playwright page object.
     * @param {Partial<IGrizzlySmsVerificatorOptions>} [options={}] - Optional overrides for configuration.
     * @returns {Promise<string>} A promise that resolves with the phone number.
     */
    async getNumber(_page, options = {}) {
        // Self-healing: Cancel any orphaned activation from a previous failed run.
        if (this.activeActivation) {
            this._logWarn(`An orphaned activation (ID: ${this.activeActivation.id}) was found. Cancelling it automatically before getting a new number.`);
            await this._cancelActiveActivation();
        }
        const activation = await this.numberPoolManager.requestNumber(options);
        this.activeActivation = activation;
        this.isVerificationAttempted = false;
        this._logInfo(`Acquired number ${activation.number} from pool for country ${activation.country}. Set as active activation.`);
        return activation.number;
    }
    /**
     * @description Polls the API for the verification code for the active number with a configurable timeout.
     * @param {ModulesHelper.Page} _page - The Playwright page object.
     * @param {object} [options={}] - Options for the verification process.
     * @param {number} [options.timeout=60000] - The polling timeout in milliseconds.
     * @returns {Promise<string | null>} A promise that resolves with the verification code, or null if the timeout is reached.
     */
    async getVerificationCode(_page, options = {}) {
        if (!this.activeActivation) {
            throw this._createError('Activation not found. Please get a number first.', 'STATE_ERROR');
        }
        const { id: activationId, country } = this.activeActivation;
        const { timeout = 60000 } = options; // Default timeout of 60 seconds.
        // This is the point of commitment. The active number is accepted and about to be used.
        this.isVerificationAttempted = true;
        await this.statsManager.updateAcceptanceStats(country, true);
        this._logInfo(`Starting to poll for SMS code for activation ID: ${activationId} (Country: ${country}) with a ${timeout / 1000}s timeout.`);
        const pollingInterval = 5000;
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            try {
                const response = await this.apiRequest({ action: 'getStatus', id: activationId });
                if (response.status === 'STATUS_OK' && response.values.length >= 1) {
                    const code = response.values[0];
                    this._logInfo(`Successfully received verification code for activation ${activationId}.`);
                    await this.statsManager.updateSmsDeliveryStats(country, true);
                    return code;
                }
                if (response.status === 'STATUS_CANCEL') {
                    this._logWarn(`Activation ${activationId} was cancelled remotely.`);
                    await this.statsManager.updateSmsDeliveryStats(country, false);
                    throw this._createError(`Activation ${activationId} was cancelled.`, 'OPERATION_CANCELLED');
                }
                this._logInfo(`Code not yet received for activation ${activationId}. Status: ${response.status}. Retrying...`);
            }
            catch (error) {
                // If the API request itself fails, we should still throw to let the caller handle it.
                if (error.context?.isCustomError) {
                    throw error;
                }
                this._logWarn(`API error while polling for activation ${activationId}. Retrying...`, { error: error.message });
            }
            await modules_helper_1.ModulesHelper.delay(pollingInterval);
        }
        // If the loop finishes, it means the timeout was reached.
        this._logWarn(`SMS polling timed out for activation ${activationId} after ${timeout / 1000} seconds.`);
        await this.statsManager.updateSmsDeliveryStats(country, false);
        return null;
    }
    /**
     * @description Marks the current activation as finished.
     * @param {ModulesHelper.Page} _page - The Playwright page object.
     * @private
     */
    async completeOrder(_page) {
        if (!this.activeActivation) {
            this._logWarn('No active activation to complete. Skipping.');
            return;
        }
        const { id: activationId } = this.activeActivation;
        this._logInfo(`Attempting to mark activation as finished: ${activationId}`);
        try {
            await this.apiRequest({ action: 'setStatus', status: 6, id: activationId });
            this._logInfo(`Successfully marked activation as finished: ${activationId}.`);
        }
        catch (error) {
            this._logError(`Failed to mark activation as finished: ${activationId}.`, { originalError: error });
        }
        finally {
            this._logInfo(`Resetting instance state after finishing activation: ${activationId}.`);
            this.activeActivation = null;
        }
    }
    /**
     * @description Cancels the currently active number.
     * @param {ModulesHelper.Page} _page - The Playwright page object.
     */
    async cancelNumber(_page) {
        if (!this.activeActivation) {
            this._logWarn('No active activation to cancel. Skipping.');
            return;
        }
        // If verification was never attempted, it means the number was rejected by the target service.
        if (!this.isVerificationAttempted) {
            this._logWarn(`Number ${this.activeActivation.number} from country ${this.activeActivation.country} was rejected. Updating acceptance stats.`);
            await this.statsManager.updateAcceptanceStats(this.activeActivation.country, false);
        }
        await this._cancelActiveActivation();
    }
    /**
     * @description Robustly cancels the currently active activation and clears the state.
     * It logs errors internally but does not re-throw them, preventing mission failures due to cancellation issues.
     * @private
     */
    async _cancelActiveActivation() {
        if (!this.activeActivation) {
            return;
        }
        const activationToCancel = { ...this.activeActivation };
        this._logInfo(`Attempting to cancel active activation ID: ${activationToCancel.id}`);
        try {
            await this.cancelActivation(activationToCancel.id);
            this._logInfo(`Successfully cancelled active activation ID: ${activationToCancel.id}.`);
            this.activeActivation = null;
            this.isVerificationAttempted = false;
        }
        catch (error) {
            this._logError(`Failed to cancel active activation ID: ${activationToCancel.id}. The state will be preserved for a future retry.`, { originalError: error });
            // Do not re-throw the error. The mission should not be concerned with a failed cancellation.
            // The error is logged, and the system will attempt to self-heal on the next run.
        }
    }
    /**
     * @description Cancels a specific activation by its ID. This is a robust, non-blocking, reusable method.
     * If the API denies an immediate cancellation ('EARLY_CANCEL_DENIED'), it schedules a retry in the background
     * without blocking the main execution thread. The method returns a Promise that resolves immediately
     * in such cases, allowing the calling mission to proceed.
     * @param {string} activationId - The ID of the activation to cancel.
     * @returns {Promise<void>} A promise that resolves when the cancellation is either completed or scheduled. It rejects only on unexpected API errors.
     * @public
     */
    async cancelActivation(activationId) {
        if (!activationId) {
            return;
        }
        // If a cancellation for this ID is already pending, do nothing.
        if (this.pendingCancellations.has(activationId)) {
            this._logInfo(`Cancellation for activation ID ${activationId} is already scheduled.`);
            return;
        }
        this._logInfo(`Attempting to cancel activation ID: ${activationId}`);
        try {
            const response = await this.apiRequest({ action: 'setStatus', status: 8, id: activationId });
            if (response.status === 'ACCESS_CANCEL') {
                this._logInfo(`Successfully cancelled activation ID: ${activationId}.`);
                return;
            }
            if (response.status === 'EARLY_CANCEL_DENIED') {
                this._logWarn(`Early cancel denied for activation ${activationId}. Scheduling a retry in 60 seconds.`);
                const timeoutId = setTimeout(() => {
                    this._logInfo(`Executing scheduled cancellation for activation ID: ${activationId}.`);
                    this.pendingCancellations.delete(activationId); // Remove from map before retrying
                    this.cancelActivation(activationId).catch(err => {
                        this._logError(`Scheduled cancellation for activation ID ${activationId} failed.`, { originalError: err });
                    });
                }, 30000);
                this.pendingCancellations.set(activationId, timeoutId);
                // IMPORTANT: Do not throw an error here. The cancellation is now handled in the background.
                // The calling function can proceed without being blocked or failing.
                return;
            }
            // For any other failed status, log it but treat it as a final failure for this attempt.
            // We throw here because it's an unexpected state, unlike EARLY_CANCEL_DENIED.
            throw this.createError(`Failed to cancel activation ID: ${activationId}. Final status: ${response.status}`, 'CANCELLATION_FAILED');
        }
        catch (error) {
            // This catch block now handles initial API request failures or the thrown CANCELLATION_FAILED error.
            const cancellationError = this.createError(`Failed to process cancellation for activation ID: ${activationId}.`, 'CANCELLATION_FAILED', { originalError: error });
            this._logError(cancellationError.message, { originalError: error });
            throw cancellationError;
        }
    }
    /**
     * @description Cleans up all resources held by the extension, including active and pooled activations.
     * @param {ModulesHelper.Page} _page - The Playwright page object.
     */
    async cleanup(_page) {
        this._logInfo('Starting cleanup of all GrizzlySMS resources...');
        const cancellationPromises = [];
        // Clear any scheduled background cancellations to prevent them from running after the session ends.
        if (this.pendingCancellations.size > 0) {
            this._logInfo(`Clearing ${this.pendingCancellations.size} scheduled cancellations.`);
            this.pendingCancellations.forEach((timeoutId, activationId) => {
                clearTimeout(timeoutId);
                this._logInfo(`Cancelled scheduled retry for activation ID: ${activationId}.`);
            });
            this.pendingCancellations.clear();
        }
        if (this.activeActivation) {
            cancellationPromises.push(this._cancelActiveActivation());
        }
        cancellationPromises.push(this.numberPoolManager.cleanup());
        const results = await Promise.allSettled(cancellationPromises);
        results.forEach(result => {
            if (result.status === 'rejected') {
                this._logWarn('A cancellation failed during cleanup. See previous logs for details.', { reason: result.reason });
            }
        });
        // Reset the state regardless of cancellation success, as the session is over.
        this.activeActivation = null;
        this.isVerificationAttempted = false;
        this._logInfo('GrizzlySMS cleanup complete.');
    }
}
exports.default = GrizzlySmsVerificator;
//# sourceMappingURL=grizzlysmsverificator.js.map
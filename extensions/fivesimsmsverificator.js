"use strict";
/**
 * @description 5Sim.net SMS verification extension. Uses ModulesHelper.axios for Node.js-based API requests.
 * @author UWAS.DEV
 * @date 2025-11-05
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
const modules_helper_1 = require("../modules-helper");
const API_BASE_URL = 'https://5sim.net/v1/user';
class FiveSimSmsVerificator extends modules_helper_1.ModulesHelper.BaseExtension {
    orderId = null;
    phoneNumber = null;
    constructor(options = {}) {
        super(options);
    }
    static getDefaultConfig() {
        return {
            apiKey: '',
            product: '',
            country: '',
            operator: '',
            enabled: true,
        };
    }
    static getMetadata() {
        return {
            id: 'fivesimsmsverification',
            title: '5Sim SMS Verification',
            description: 'Automates SMS verification using the 5Sim.net service. This extension is session-based and maintains its state across multiple calls within the same session.',
            icon: '📱',
            category: 'Verification',
            enabled: false,
            sessionbased: true,
            order: 10,
            version: '1.1.0',
            capabilities: ['sms-verification'],
        };
    }
    validate(_config) {
        return Promise.resolve();
    }
    getConfigSchema() {
        return modules_helper_1.ModulesHelper.z.object({
            apiKey: modules_helper_1.ModulesHelper.z.string().min(1, { message: '5Sim API Key is required.' }),
            product: modules_helper_1.ModulesHelper.z.string().min(1, { message: '5Sim Product is required.' }),
            country: modules_helper_1.ModulesHelper.z.string().optional(),
            operator: modules_helper_1.ModulesHelper.z.string().optional(),
        });
    }
    static getSettingsUI() {
        const defaultConfig = this.getDefaultConfig();
        return [
            {
                type: 'password',
                name: 'apiKey',
                label: 'API Key',
                placeholder: 'Enter your 5Sim API Key',
                defaultValue: defaultConfig.apiKey,
            },
            {
                type: 'text',
                name: 'product',
                label: 'Product',
                placeholder: 'e.g., google, telegram, any',
                defaultValue: defaultConfig.product,
            },
            {
                type: 'text',
                name: 'country',
                label: 'Country',
                placeholder: 'e.g., russia, germany, any',
                defaultValue: defaultConfig.country,
            },
            {
                type: 'text',
                name: 'operator',
                label: 'Operator',
                placeholder: 'e.g., megafon, tele2, any',
                defaultValue: defaultConfig.operator,
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
            </ul>
            <p><strong>Example Usage in a Mission or Navigator:</strong></p>
            <pre><code>
            const phoneNumber = await this.extensionsOrchestrator.executeCapability({
              capability: 'sms-verification',
              shortcode: 'GET_NUMBER',
              args: [{ country: 'poland' }] // Optional override
            });
            </code></pre>
        `;
    }
    _run(page, options) {
        const { shortcode, args, abortSignal } = options;
        switch (shortcode) {
            case 'GET_NUMBER': {
                const getNumberOptions = args[0] || {};
                return this.getNumber(page, getNumberOptions);
            }
            case 'GET_VERIFICATION_CODE':
                return this.getVerificationCode(page, abortSignal);
            case 'CANCEL_NUMBER':
                return this.cancelNumber(page);
            case 'COMPLETE_ORDER':
                return this.completeOrder(page);
            default:
                return Promise.reject(this._createError(`Shortcode '${shortcode}' is not supported.`, 'UNSUPPORTED_SHORTCODE'));
        }
    }
    async apiRequest(endpoint, params = {}) {
        if (!this.config.apiKey) {
            throw this._createError('5Sim API Key is not configured.', 'CONFIGURATION_ERROR');
        }
        const sanitizedApiKey = (this.config.apiKey || '').replace(/[{}"']/g, '').trim();
        if (!sanitizedApiKey) {
            throw this._createError('5Sim API Key is not configured or is invalid.', 'CONFIGURATION_ERROR');
        }
        const url = `${API_BASE_URL}/${endpoint}`;
        try {
            const response = await modules_helper_1.ModulesHelper.axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${sanitizedApiKey}`,
                    'Accept': 'application/json',
                },
                params,
            });
            return response.data;
        }
        catch (error) {
            const errorData = error.response?.data || error.message;
            this._logError(`5Sim API request to '${endpoint}' failed`, { error: errorData });
            throw this._createError(`5Sim API Error: ${errorData}`, 'API_REQUEST_FAILED', { originalError: error });
        }
    }
    /**
     * @method getNumber
     * @description Requests a new phone number from the 5Sim service by merging base configuration with call-specific options.
     * @param {ModulesHelper.Page} page - The Playwright page instance (kept for signature consistency, but not used in API request).
     * @param {Partial<IFiveSimSmsVerificatorOptions>} [options={}] - Call-specific options (e.g., product, country) to override the base config.
     * @returns {Promise<string>} The acquired phone number.
     * @throws {Error} If the API key or product is not configured, or if the API call fails.
     */
    async getNumber(page, options = {}) {
        if (this.orderId && this.phoneNumber) {
            this._logInfo(`Reusing existing order ID: ${this.orderId}`);
            return this.phoneNumber;
        }
        const finalOptions = { ...this.config, ...options };
        const { product, country, operator } = finalOptions;
        this._logInfo(`Requesting new number for product: ${product} in ${country || 'any'}`);
        if (!product) {
            throw this._createError('5Sim Product is not configured in extension settings or provided as an argument.', 'CONFIGURATION_ERROR');
        }
        const countryPath = country || 'any';
        const operatorPath = operator || 'any';
        const response = await this.apiRequest(`buy/activation/${countryPath}/${operatorPath}/${product}`);
        if (!response || !response.id || !response.phone) {
            const errorMessage = response?.msg || 'The API response did not contain a valid phone number or order ID.';
            throw this._createError(`5Sim number acquisition failed: ${errorMessage}`, 'API_ERROR');
        }
        this.orderId = response.id;
        this.phoneNumber = response.phone;
        this._logInfo(`New Order ID ${this.orderId} and phone number saved to instance state.`);
        return response.phone;
    }
    /**
     * @method getVerificationCode
     * @description Polls the 5Sim service to retrieve the SMS verification code for the current instance's order.
     * @param {ModulesHelper.Page} page - The Playwright page instance (kept for signature consistency, but not used in API request).
     * @param {AbortSignal} [abortSignal] - Optional signal to abort the execution.
     * @returns {Promise<string>} The verification code extracted from the most recent SMS.
     * @throws {Error} If the order ID is not found, API errors occur, or if polling times out.
     */
    async getVerificationCode(page, abortSignal) {
        const { orderId } = this;
        if (!orderId) {
            throw this._createError('Order ID not found in instance state. Please get a number first.', 'STATE_ERROR');
        }
        this._logInfo(`Starting to poll for SMS code for order ID: ${orderId}`);
        const pollingTimeout = 60000;
        const pollingInterval = 5000;
        const startTime = Date.now();
        while (Date.now() - startTime < pollingTimeout) {
            if (abortSignal?.aborted) {
                this._logWarn(`SMS polling aborted by user for order ID: ${orderId}. Cancelling order.`);
                await this.apiRequest(`cancel/${orderId}`).catch(err => this._logError(`Failed to cancel aborted order ${orderId}`, err));
                throw this._createError('Operation was aborted by the user.', 'OPERATION_ABORTED', { isGracefulShutdown: true });
            }
            try {
                const codeResponse = await this.apiRequest(`check/${orderId}`);
                if (codeResponse && codeResponse.status === 'RECEIVED' && Array.isArray(codeResponse.sms) && codeResponse.sms.length > 0) {
                    const latestSms = codeResponse.sms[codeResponse.sms.length - 1];
                    this._logInfo(`Latest SMS structure for order ${orderId}: Sender: ${latestSms?.sender || 'N/A'}, Has Code: ${Boolean(latestSms?.code)}`);
                    if (latestSms && latestSms.code && latestSms.code.trim()) {
                        const verificationCode = latestSms.code.trim();
                        this._logInfo(`Successfully received verification code for order ${orderId}. Code: ${verificationCode}`);
                        return verificationCode;
                    }
                    this._logWarn(`SMS received but no valid code found for order ${orderId}.`);
                }
                const elapsedTime = Math.round((Date.now() - startTime) / 1000);
                this._logInfo(`Code not yet received for order ${orderId}. Status: ${codeResponse?.status || 'UNKNOWN'}. Elapsed: ${elapsedTime}s. Retrying...`);
            }
            catch (error) {
                const elapsedTime = Math.round((Date.now() - startTime) / 1000);
                this._logWarn(`API error while polling for order ${orderId} (elapsed: ${elapsedTime}s). Error: ${error.message}. Continuing...`);
            }
            await new Promise(resolve => setTimeout(resolve, pollingInterval));
        }
        this._logWarn(`SMS code polling timed out for order ID: ${orderId}. The mission is now responsible for cancelling the order.`);
        throw this._createError(`SMS code polling timed out for order ID: ${orderId}`, 'TIMEOUT_ERROR');
    }
    /**
     * @method completeOrder
     * @description Marks the current order as finished on the 5Sim service and resets the state.
     * @param {ModulesHelper.Page} _page - The Playwright page instance (for signature consistency).
     * @returns {Promise<void>}
     */
    async completeOrder(_page) {
        const { orderId } = this;
        if (!orderId) {
            this._logWarn('No active order to complete. Skipping.');
            return;
        }
        this._logInfo(`Attempting to mark order as finished: ${orderId}`);
        try {
            await this.apiRequest(`finish/${orderId}`);
            this._logInfo(`Successfully marked order as finished: ${orderId}.`);
        }
        catch (error) {
            // Log the error but don't re-throw.
            // The main goal (verification) was successful. Failing to mark as 'finish'
            // is a non-critical cleanup step.
            this._logError(`Failed to mark order as finished: ${orderId}. The service might have already closed it.`, { originalError: error });
        }
        finally {
            // Always reset the state after finishing to prevent reuse.
            this._logInfo(`Resetting instance state after finishing order: ${orderId}.`);
            this.orderId = null;
            this.phoneNumber = null;
        }
    }
    /**
     * @method cancelNumber
     * @description Cancels the current order and resets the instance's state.
     * @param {ModulesHelper.Page} _page - The Playwright page instance (for signature consistency).
     * @returns {Promise<void>}
     */
    async cancelNumber(_page) {
        const { orderId } = this;
        if (!orderId) {
            this._logWarn('No active order to cancel. Skipping.');
            return; // No order to cancel, so we can consider this a success.
        }
        this._logInfo(`Attempting to cancel order ID: ${orderId}`);
        try {
            await this.apiRequest(`cancel/${orderId}`);
            this._logInfo(`Successfully cancelled order ID: ${orderId}.`);
        }
        catch (error) {
            // Log the error but don't re-throw.
            // The primary goal is to get a new number, and failing to cancel a previous one
            // shouldn't block the entire process. The 5sim service will eventually timeout the old order.
            this._logError(`Failed to cancel order ID: ${orderId}. The service might have already closed it.`, { originalError: error });
        }
        finally {
            // Always reset the state to prevent reuse of a cancelled or failed-to-cancel order.
            this._logInfo(`Resetting instance state for order ID: ${orderId}.`);
            this.orderId = null;
            this.phoneNumber = null;
        }
    }
}
exports.default = FiveSimSmsVerificator;
//# sourceMappingURL=fivesimsmsverificator.js.map
"use strict";
/**
 * @description Provides an extension to generate Time-based One-Time Passwords (TOTP) from a secret key.
 * @author UWAS.DEV
 * @date 2025-11-14
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
const modules_helper_1 = require("../modules-helper");
/**
 * @class AuthenticatorExtension
 * @description A stateless extension to generate TOTP codes on-the-fly.
 */
class AuthenticatorExtension extends modules_helper_1.ModulesHelper.BaseExtension {
    /**
     * @method getMetadata
     * @description Gets the static metadata for the extension.
     * @returns {ModulesHelper.IExtensionMetadata} The extension's metadata.
     * @static
     */
    static getMetadata() {
        return {
            id: 'authenticator',
            title: 'Instant Authenticator',
            description: 'Generates a TOTP code from a given secret key on the fly.',
            icon: '🔐',
            category: 'Verification',
            enabled: true,
            sessionbased: false, // This extension is stateless
            capabilities: ['2fa-authentication'],
        };
    }
    /**
     * @method getInfoUI
     * @description Gets the informational HTML content for the extension.
     * @returns {string} An HTML string.
     * @static
     */
    static getInfoUI() {
        return `
      <h4>How to use in a Mission or Navigator:</h4>
      <p>This extension generates a TOTP code instantly from a secret key.</p>
      <ul>
          <li><strong>Get Code:</strong> <code>[2fa-authentication:GET_CODE:YOUR_SECRET_KEY]</code></li>
      </ul>
      <p><strong>Example Usage:</strong></p>
      <pre><code>
      const code = await this.shortcodeProcessor.process(
        '[2fa-authentication:GET_CODE:JBSWY3DPEHPK3PXP]'
      );
      </code></pre>
    `;
    }
    static getDefaultConfig() {
        return {
            enabled: true,
        };
    }
    getConfigSchema() {
        return {};
    }
    validate() {
        return Promise.resolve();
    }
    /**
     * @method _run
     * @description The core logic of the shortcode execution.
     * @param {ModulesHelper.Page} _page - The Playwright page instance (not used in this stateless extension).
     * @param {ModulesHelper.IExtensionExecutionContext} options - The execution context.
     * @returns {Promise<string>} The generated 6-digit TOTP code.
     * @protected
     */
    _run(_page, options) {
        const { shortcode, args } = options;
        const [secretKey] = args;
        if (shortcode !== 'GET_CODE') {
            throw this._createError(`Shortcode '${shortcode}' is not supported.`, 'UNSUPPORTED_SHORTCODE');
        }
        if (!secretKey || typeof secretKey !== 'string') {
            throw this._createError('Secret key is required as the first argument.', 'INVALID_ARGUMENT');
        }
        try {
            const code = this.generateTOTP(secretKey);
            this._logInfo('Successfully generated TOTP code.');
            return Promise.resolve(code);
        }
        catch (error) {
            this._logError('Failed to generate TOTP code.', { originalError: error });
            throw this._createError(`Failed to generate code: ${error.message}`, 'GENERATION_FAILED');
        }
    }
    /**
     * @method base32tohex
     * @description Converts a base32 string to a hex string.
     * @param {string} base32 - The base32 encoded string.
     * @returns {string} The hex encoded string.
     * @private
     */
    base32tohex(base32) {
        const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let bits = '';
        let hex = '';
        const sanitizedBase32 = base32.replace(/=+$/, '').toUpperCase();
        for (const char of sanitizedBase32) {
            const val = base32chars.indexOf(char);
            if (val === -1) {
                throw new Error('Invalid base32 character found');
            }
            bits += val.toString(2).padStart(5, '0');
        }
        for (let i = 0; i + 4 <= bits.length; i += 4) {
            const chunk = bits.substr(i, 4);
            hex += parseInt(chunk, 2).toString(16);
        }
        return hex;
    }
    /**
     * @method generateTOTP
     * @description Generates a TOTP code based on the provided secret.
     * @param {string} secret - The base32 encoded secret key.
     * @param {number} [period=30] - The time step in seconds.
     * @param {number} [digits=6] - The number of digits for the code.
     * @returns {string} The generated TOTP code.
     * @private
     */
    generateTOTP(secret, period = 30, digits = 6) {
        try {
            const hexSecret = this.base32tohex(secret);
            const key = modules_helper_1.ModulesHelper.CryptoJS.enc.Hex.parse(hexSecret);
            const epoch = Math.round(new Date().getTime() / 1000.0);
            const time = Math.floor(epoch / period).toString(16).padStart(16, '0');
            const timeHex = modules_helper_1.ModulesHelper.CryptoJS.enc.Hex.parse(time);
            const hmac = modules_helper_1.ModulesHelper.CryptoJS.HmacSHA1(timeHex, key);
            const hmacResult = hmac.toString(modules_helper_1.ModulesHelper.CryptoJS.enc.Hex);
            const offset = parseInt(hmacResult.substring(hmacResult.length - 1), 16);
            const otp = String(parseInt(hmacResult.substr(offset * 2, 8), 16) & 0x7fffffff);
            return otp.slice(-digits).padStart(digits, '0');
        }
        catch (error) {
            throw new Error('Failed to generate TOTP. Check if the secret key is a valid base32 string.');
        }
    }
}
exports.default = AuthenticatorExtension;
//# sourceMappingURL=authenticator.js.map
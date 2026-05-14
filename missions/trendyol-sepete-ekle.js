"use strict";
/**
 * @description Trendyol üzerinde ürün arayıp sepete ekleme akışını insansı etkileşimlerle uygular.
 * @author UWAS.DEV
 * @date 2026-05-14
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
const modules_helper_1 = require("../modules-helper");
const SEARCH_INPUT_SELECTOR = '#responsive-navigation-layout > div > div > div.search-bar-wrapper > div > button.suggestion-placeholder > span';
const SEARCH_INPUT_ACTIVE_SELECTOR = '#responsive-navigation-layout > div > div > div.search-bar-wrapper > div > div.search-bar-new-input-active > input';
const BASKET_SELECTOR = '#responsive-navigation-layout > div > div > div.navigation-menu-wrapper > div.basket-wrapper.menu-item';
const ADD_TO_CART_TEXT = 'Sepete Ekle';
const ACCEPT_COOKIES_SELECTOR = '#onetrust-accept-btn-handler';
const SATICI_ADI = 'SIZIN_MAGAZA_ADINIZ';
const ARAMA_TERIMI = 'SIZIN_ARAMA_TERIMINIZ';
class TrendyolSepeteEkleMission extends modules_helper_1.ModulesHelper.BaseMission {
    static getMetadata() {
        return {
            id: 'trendyol_sepete_ekle',
            title: 'Trendyol Sepete Ekle',
            description: 'Trendyol içinde arama yapar, hedef ürüne gider, sepete ekler ve sepeti açar.',
            icon: '🛒',
            category: 'ecommerce',
            enabled: true,
            order: 40,
            version: '1.0.0',
            features: ['search', 'humanized-interaction', 'cart'],
        };
    }
    static getDefaultConfig() {
        return {
            ...super.getDefaultConfig(),
            mouseMovement: true,
            scrolling: true,
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
        this._logInfo('🛒 Starting Trendyol Sepete Ekle mission.');
        if (!this.enabled) {
            this.emitMissionCompleted(true, 'successful_completion', { reason: 'disabled' });
            return { success: true, reason: 'disabled' };
        }
        const startTime = Date.now();
        try {
            await this.nav.validateNavigationContext({ page, abortSignal: options.abortSignal });
            await this.nav.assertNavigationState(page, {
                bodyShouldContain: ['body'],
                hostnameShouldMatch: 'trendyol.com',
            });
            this._logInfo('⏳ Navigation sonrası popup bekleme başlıyor (3-5sn).');
            await modules_helper_1.ModulesHelper.Helpers.randomDelay(3000, 5000);
            this._logInfo('🍪 Çerez popup kontrolü başlıyor.');
            await this._acceptCookiesIfVisible(page, options);
            this._logInfo('🖱️ İlk random mouse move + scroll başlıyor.');
            await this._performRandomMouseMove(page);
            await this._performRandomScroll(page);
            this._logInfo('🔎 Arama kutusuna tıklama başlıyor.');
            await this._humanClick(page, [SEARCH_INPUT_SELECTOR], false, options);
            this._logInfo('⌨️ Arama yazımı ve enter başlıyor.');
            await this._typeSearchTermAndSubmit(page, options);
            this._logInfo('⏳ Arama sonrası sonuç sayfası yük durumu bekleniyor.');
            await page.waitForLoadState('domcontentloaded');
            await modules_helper_1.ModulesHelper.Helpers.randomDelay(400, 900);
            this._logInfo('🖱️ Satıcı tıklamasından önce random mouse move + random scroll başlıyor.');
            await this._performRandomMouseMove(page);
            await this._performRandomScroll(page);
            await modules_helper_1.ModulesHelper.Helpers.randomDelay(700, 1400);
            this._logInfo('🎯 Satıcı adı içeren elemente tıklama başlıyor.', { satici: SATICI_ADI });
            const newPage = await this._clickSellerWithProgressiveScroll(page, SATICI_ADI, options);
            this._logInfo('🖱️ Ürün sayfası random mouse move + scroll başlıyor.');
            await this._performRandomMouseMove(newPage);
            await this._performRandomScroll(newPage);
            this._logInfo('🛒 Sepete Ekle butonu tıklaması başlıyor (Text selector).', { text: ADD_TO_CART_TEXT });
            await this._humanClick(newPage, [`text=${ADD_TO_CART_TEXT}`], false, options);
            this._logInfo('🖱️ Sepet öncesi random mouse move + scroll başlıyor.');
            await this._performRandomMouseMove(newPage);
            await this._performRandomScroll(newPage);
            this._logInfo('🧺 Sepetim tıklaması başlıyor (navigation beklentili).');
            await this._humanClick(newPage, [BASKET_SELECTOR], true, options);
            this._logInfo('🖱️ Sepet sayfası yüklendikten sonra random mouse move + scroll başlıyor.');
            await this._performRandomMouseMove(newPage);
            await this._performRandomScroll(newPage);
            const duration = Date.now() - startTime;
            const resultData = { duration, saticiAdi: SATICI_ADI };
            this.emitMissionCompleted(true, 'successful_completion', resultData);
            return { success: true, reason: 'successful_completion', data: resultData };
        }
        catch (error) {
            const enhancedError = await this.nav.handleNavigationError(error, {
                operation: 'trendyol_sepete_ekle_execution',
                missionType: this.getModuleType(),
                targetURL: SATICI_ADI,
            });
            this.emitMissionCompleted(false, 'error', {
                error: enhancedError.message,
                targetURL: SATICI_ADI,
            });
            throw enhancedError;
        }
    }
    async _performRandomMouseMove(page) {
        await modules_helper_1.ModulesHelper.Helpers.mouseMove(page, {
            steps: { min: 14, max: 28 },
            delay: { min: 12, max: 30 },
            pauseChance: 0.35,
            pauseDuration: { min: 100, max: 600 },
        });
        await modules_helper_1.ModulesHelper.Helpers.randomDelay(150, 450);
    }
    async _performRandomScroll(page, longScroll = false) {
        await modules_helper_1.ModulesHelper.Helpers.scrollPage(page, {
            steps: longScroll ? { min: 14, max: 24 } : { min: 5, max: 10 },
            delay: longScroll ? { min: 18, max: 32 } : { min: 10, max: 20 },
            amount: longScroll ? { min: 260, max: 520 } : { min: 90, max: 180 },
            direction: 'down',
            pauseChance: 0.3,
            pauseDuration: { min: 80, max: 480 },
        });
        await modules_helper_1.ModulesHelper.Helpers.randomDelay(120, 400);
    }
    async _humanClick(page, selectors, expectsNavigation, options) {
        const clicked = await this.interactionService.handleElementInteraction(page, {
            selectors,
            actions: ['hover', 'wait', 'click'],
            expectsNavigation,
            maxRetries: 2,
            watchdogFeed: options.watchdogFeed,
            waitDelay: { min: 250, max: 650 },
            interactionOptions: {
                hover: { delay: { min: 300, max: 700 } },
            },
        });
        if (!clicked) {
            throw this._createError(`Element click failed for selectors: ${selectors.join(' | ')}`, 'ELEMENT_CLICK_FAILED');
        }
    }
    async _typeSearchTermAndSubmit(page, options) {
        this._logInfo('⌨️ Arama etkileşimi gönderiliyor.', { selector: SEARCH_INPUT_ACTIVE_SELECTOR, text: ARAMA_TERIMI });
        const typed = await this.interactionService.handleElementInteraction(page, {
            selectors: [SEARCH_INPUT_ACTIVE_SELECTOR],
            actions: ['hover', 'wait', 'click', 'wait', 'click', 'wait', 'type'],
            typeText: ARAMA_TERIMI,
            clearFirst: true,
            maxRetries: 2,
            watchdogFeed: options.watchdogFeed,
            waitDelay: { min: 120, max: 260 },
            interactionOptions: {
                hover: { delay: { min: 140, max: 280 } },
                type: { delay: { min: 60, max: 110 }, typos: { min: 0, max: 0 } },
            },
        });
        if (!typed) {
            this._logInfo('❌ Arama etkileşimi başarısız döndü.', { selector: SEARCH_INPUT_ACTIVE_SELECTOR });
            throw this._createError('Arama kutusuna yazıp enter gönderilemedi.', 'SEARCH_SUBMIT_FAILED');
        }
        this._logInfo('✅ Arama etkileşimi başarılı tamamlandı. Enter gönderiliyor.');
        await modules_helper_1.ModulesHelper.Helpers.randomDelay(120, 260);
        await page.keyboard.press('Enter');
        try {
            await page.waitForURL(url => url.toString().includes('/sr?') || url.toString().includes('/sr/'), { timeout: 12000 });
            this._logInfo('✅ Enter sonrası arama sonuç sayfası algılandı.', { url: page.url() });
        }
        catch {
            this._logInfo('ℹ️ Enter sonrası beklenen URL paterni zamanında algılanamadı, akış devam ediyor.', { url: page.url() });
        }
    }
    async _clickSellerWithProgressiveScroll(page, sellerName, _options) {
        const maxLongScrollCycles = 12;
        // Use a selector that searches for text matching the seller name.  We want to find elements containing the text.
        // xpath: //*[contains(text(), "Meyar")]/ancestor::a  (find anchor parent of element containing text)
        const sellerXPath = `//div[contains(@class, 'prdct-desc-cntnr') and contains(., '${sellerName}')]/ancestor::a | //*[contains(text(), '${sellerName}')]/ancestor::a`;
        for (let cycle = 0; cycle < maxLongScrollCycles; cycle += 1) {
            // Find elements that match the xpath. Playwright automatically waits, but we just check visibility
            const anchor = page.locator(`xpath=${sellerXPath}`).first();
            const visible = await anchor.isVisible().catch(() => false);
            if (visible) {
                this._logInfo(`✅ Satıcı element bulundu: ${sellerName}`);
                await anchor.scrollIntoViewIfNeeded().catch(() => undefined);
                await modules_helper_1.ModulesHelper.Helpers.randomDelay(180, 420);
                await anchor.hover({ timeout: 5000 }).catch(() => undefined);
                await modules_helper_1.ModulesHelper.Helpers.randomDelay(250, 650);
                // Trendyol opens product links in a new tab. We must capture it.
                const pagePromise = page.context().waitForEvent('page');
                await anchor.click({ timeout: 7000 });
                const newPage = await pagePromise;
                await newPage.waitForLoadState('domcontentloaded');
                this._logInfo(`✅ Yeni sekme açıldı ve yüklendi: ${newPage.url()}`);
                return newPage;
            }
            await this._performRandomScroll(page, true);
            await this._performRandomMouseMove(page);
            await this._performRandomScroll(page, false);
            await this._performRandomMouseMove(page);
        }
        throw this._createError(`Satıcı adı uzun kaydırma sonrası bulunamadı: ${sellerName}`, 'SELLER_NOT_FOUND');
    }
    async _acceptCookiesIfVisible(page, options) {
        const isVisible = await page.locator(ACCEPT_COOKIES_SELECTOR).first().isVisible().catch(() => false);
        this._logInfo('🍪 Çerez popup görünürlük kontrolü tamamlandı.', { isVisible, selector: ACCEPT_COOKIES_SELECTOR });
        if (!isVisible) {
            return;
        }
        this._logInfo('🍪 Çerez kabul butonuna tıklanıyor.');
        await this._humanClick(page, [ACCEPT_COOKIES_SELECTOR], false, options);
        await modules_helper_1.ModulesHelper.Helpers.randomDelay(200, 500);
        this._logInfo('🍪 Çerez kabul tıklaması tamamlandı.');
    }
    shouldComplete(_context = {}) {
        return true;
    }
}
exports.default = TrendyolSepeteEkleMission;
//# sourceMappingURL=trendyol-sepete-ekle.js.map
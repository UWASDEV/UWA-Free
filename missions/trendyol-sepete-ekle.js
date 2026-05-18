/**
 * @description Trendyol üzerinde ürün arayıp sepete ekleme akışını insansı etkileşimlerle uygular.
 * @author UWAS.DEV
 * @date 2026-05-14
 * @version 1.0.0
 */

import { ModulesHelper } from '../modules-helper';

const SEARCH_INPUT_SELECTOR = '#responsive-navigation-layout > div > div > div.search-bar-wrapper > div > button.suggestion-placeholder > span';
const SEARCH_INPUT_ACTIVE_SELECTOR = '#responsive-navigation-layout > div > div > div.search-bar-wrapper > div > div.search-bar-new-input-active > input';
const ADD_TO_CART_TEXT = 'Şimdi Al';
const LOCATION_SELECT_BUTTON_SELECTOR = '#envoy > div > div:nth-child(1) > div > div.location-based-delivery > div > div.location-select-button-wrapper > div > div > button';

const MARKET_ID = 'SIZIN_SATICI_ID_NUMARANIZ';
const ARAMA_TERIMI = 'SIZIN_ARAMA_KELIMENIZ';
const ACCEPT_COOKIES_SELECTOR = '#onetrust-accept-btn-handler';

export interface ITrendyolSepeteEkleMissionMetadata extends ModulesHelper.IMissionMetadata {
  // No additional properties needed.
}

class TrendyolSepeteEkleMission extends ModulesHelper.BaseMission<ModulesHelper.IBaseMissionOptions> {
  public static getMetadata(): ITrendyolSepeteEkleMissionMetadata {
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

  public static getDefaultConfig(): ModulesHelper.IBaseMissionOptions {
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

  public getConfigSchema(): object {
    return {};
  }

  public validate(_config: ModulesHelper.IBaseMissionOptions): Promise<void> {
    return Promise.resolve();
  }

  protected async _run(page: ModulesHelper.Page, options: ModulesHelper.IModuleExecutionContext): Promise<ModulesHelper.IMissionResult> {
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
      await ModulesHelper.Helpers.randomDelay(3000, 5000);
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
      await ModulesHelper.Helpers.randomDelay(400, 900);

      this._logInfo('🖱️ Satıcı tıklamasından önce random mouse move + random scroll başlıyor.');
      await this._performRandomMouseMove(page);
      await this._performRandomScroll(page);
      await ModulesHelper.Helpers.randomDelay(700, 1400);

      this._logInfo('🎯 MARKET_ID içeren ürün kartına tıklama başlıyor.', { marketId: MARKET_ID });
      const newPage = await this._clickProductCardByMarketIdWithProgressiveScroll(page, MARKET_ID, options);

      this._logInfo('🖱️ Ürün sayfası random mouse move + scroll başlıyor.');
      await this._performRandomMouseMove(newPage);
      await this._performRandomScroll(newPage);

      this._logInfo('📍 Lokasyon seçim butonu görünürlük kontrolü başlıyor.');
      await this._clickLocationButtonIfVisible(newPage, options);

      this._logInfo('🛒 Şimdi Al butonu tıklaması başlıyor (navigasyon beklentili, gerektiğinde ikinci deneme).', { text: ADD_TO_CART_TEXT });
      await this._clickBuyNowWithRetryNavigation(newPage, options);

      this._logInfo('🖱️ Sepet sayfası yüklendikten sonra random mouse move + scroll başlıyor.');
      await this._performRandomMouseMove(newPage);
      await this._performRandomScroll(newPage);

      const duration = Date.now() - startTime;
      const resultData = { duration, marketId: MARKET_ID };

      this.emitMissionCompleted(true, 'successful_completion', resultData);
      return { success: true, reason: 'successful_completion', data: resultData };
    } catch (error: any) {
      const enhancedError = await this.nav.handleNavigationError(error, {
        operation: 'trendyol_sepete_ekle_execution',
        missionType: this.getModuleType(),
        targetURL: MARKET_ID,
      });

      this.emitMissionCompleted(false, 'error', {
        error: enhancedError.message,
        targetURL: MARKET_ID,
      });

      throw enhancedError;
    }
  }

  private async _performRandomMouseMove(page: ModulesHelper.Page): Promise<void> {
    await ModulesHelper.Helpers.mouseMove(page, {
      steps: { min: 14, max: 28 },
      delay: { min: 12, max: 30 },
      pauseChance: 0.35,
      pauseDuration: { min: 100, max: 600 },
    });
    await ModulesHelper.Helpers.randomDelay(150, 450);
  }

  private async _performRandomScroll(page: ModulesHelper.Page, longScroll: boolean = false): Promise<void> {
    await ModulesHelper.Helpers.scrollPage(page, {
      steps: longScroll ? { min: 14, max: 24 } : { min: 5, max: 10 },
      delay: longScroll ? { min: 18, max: 32 } : { min: 10, max: 20 },
      amount: longScroll ? { min: 260, max: 520 } : { min: 90, max: 180 },
      direction: 'down',
      pauseChance: 0.3,
      pauseDuration: { min: 80, max: 480 },
    });
    await ModulesHelper.Helpers.randomDelay(120, 400);
  }

  private async _humanClick(
    page: ModulesHelper.Page,
    selectors: string[],
    expectsNavigation: boolean,
    options: ModulesHelper.IModuleExecutionContext,
  ): Promise<void> {
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

  private async _typeSearchTermAndSubmit(page: ModulesHelper.Page, options: ModulesHelper.IModuleExecutionContext): Promise<void> {
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

    await ModulesHelper.Helpers.randomDelay(120, 260);
    await page.keyboard.press('Enter');

    try {
      await page.waitForURL(url => url.toString().includes('/sr?') || url.toString().includes('/sr/'), { timeout: 12000 });
      this._logInfo('✅ Enter sonrası arama sonuç sayfası algılandı.', { url: page.url() });
    } catch {
      this._logInfo('ℹ️ Enter sonrası beklenen URL paterni zamanında algılanamadı, akış devam ediyor.', { url: page.url() });
    }
  }

  private async _clickProductCardByMarketIdWithProgressiveScroll(
    page: ModulesHelper.Page,
    marketId: string,
    _options: ModulesHelper.IModuleExecutionContext,
  ): Promise<ModulesHelper.Page> {
    const maxLongScrollCycles = 12;

    // Hedef: "SATICI_ADI" metni yerine ürün kartı linkindeki merchantId parametresine göre eşleşmek.
    // Örnek: <a class="product-card" href="...merchantId=107195...">
    const productCardSelector = `a.product-card[href*="merchantId=${marketId}"]`;

    for (let cycle = 0; cycle < maxLongScrollCycles; cycle += 1) {
      const anchor = page.locator(productCardSelector).first();
      const visible = await anchor.isVisible().catch(() => false);

      if (visible) {
        this._logInfo(`✅ MARKET_ID ile ürün kartı bulundu: ${marketId}`);
        await anchor.scrollIntoViewIfNeeded().catch(() => undefined);
        await ModulesHelper.Helpers.randomDelay(180, 420);
        await anchor.hover({ timeout: 5000 }).catch(() => undefined);
        await ModulesHelper.Helpers.randomDelay(250, 650);

        // Trendyol ürün kartı linkleri yeni sekmede açılabildiği için yeni sayfayı yakala.
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

    throw this._createError(`MARKET_ID ile ürün kartı uzun kaydırma sonrası bulunamadı: ${marketId}`, 'MARKET_ID_NOT_FOUND');
  }

  private async _clickLocationButtonIfVisible(page: ModulesHelper.Page, options: ModulesHelper.IModuleExecutionContext): Promise<void> {
    const isVisible = await page.locator(LOCATION_SELECT_BUTTON_SELECTOR).first().isVisible().catch(() => false);
    this._logInfo('📍 Lokasyon butonu görünürlük kontrolü tamamlandı.', {
      isVisible,
      selector: LOCATION_SELECT_BUTTON_SELECTOR,
    });

    if (!isVisible) {
      return;
    }

    this._logInfo('📍 Lokasyon seçim butonuna tıklanıyor.');
    await this._humanClick(page, [LOCATION_SELECT_BUTTON_SELECTOR], false, options);
    await ModulesHelper.Helpers.randomDelay(200, 500);
    this._logInfo('📍 Lokasyon seçim butonu tıklaması tamamlandı.');
  }

  private async _clickBuyNowWithRetryNavigation(page: ModulesHelper.Page, options: ModulesHelper.IModuleExecutionContext): Promise<void> {
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const beforeUrl = page.url();
      this._logInfo(`🛒 Şimdi Al tıklama denemesi ${attempt}/${maxAttempts}.`, { beforeUrl });

      await this._humanClick(page, [`text=${ADD_TO_CART_TEXT}`], false, options);

      const navigatedToBasket = await page
        .waitForURL(url => {
          const href = url.toString().toLowerCase();
          return href.includes('/sepet') || href.includes('/basket') || href.includes('/cart');
        }, { timeout: 7000 })
        .then(() => true)
        .catch(() => false);

      if (navigatedToBasket) {
        await page.waitForLoadState('domcontentloaded').catch(() => undefined);
        this._logInfo('✅ Şimdi Al sonrası sepet/navigasyon algılandı.', { url: page.url(), attempt });
        return;
      }

      const currentUrl = page.url();
      if (currentUrl !== beforeUrl) {
        await page.waitForLoadState('domcontentloaded').catch(() => undefined);
        this._logInfo('✅ URL değişimi algılandı, akış devam ediyor.', { beforeUrl, currentUrl, attempt });
        return;
      }

      this._logInfo('ℹ️ İlk tıklamada navigasyon algılanmadı.', { attempt, url: currentUrl });
      await ModulesHelper.Helpers.randomDelay(350, 700);
    }

    throw this._createError('Şimdi Al tıklaması sonrası navigasyon algılanamadı.', 'BUY_NOW_NAVIGATION_NOT_DETECTED');
  }

  private async _acceptCookiesIfVisible(page: ModulesHelper.Page, options: ModulesHelper.IModuleExecutionContext): Promise<void> {
    const isVisible = await page.locator(ACCEPT_COOKIES_SELECTOR).first().isVisible().catch(() => false);
    this._logInfo('🍪 Çerez popup görünürlük kontrolü tamamlandı.', { isVisible, selector: ACCEPT_COOKIES_SELECTOR });
    if (!isVisible) {
      return;
    }

    this._logInfo('🍪 Çerez kabul butonuna tıklanıyor.');
    await this._humanClick(page, [ACCEPT_COOKIES_SELECTOR], false, options);
    await ModulesHelper.Helpers.randomDelay(200, 500);
    this._logInfo('🍪 Çerez kabul tıklaması tamamlandı.');
  }

  public shouldComplete(_context: Record<string, unknown> = {}): boolean {
    return true;
  }
}

export default TrendyolSepeteEkleMission;

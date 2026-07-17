/**
 * 用无头 Chromium 完成 Stripe 托管 Checkout 页支付（真实 test-mode）。
 * 卡字段是 checkout.stripe.com 域上的原生 input（非 iframe），逐字符输入以触发 Stripe 校验；
 * 必填齐全后提交按钮才从 incomplete 变为可点。成功判定由调用方对 DB 履约的轮询决定。
 */
import { chromium, type Page } from 'playwright';
import os from 'os';
import path from 'path';
import { E2E } from './config';

async function typeInto(page: Page, selector: string, value: string, sequential: boolean) {
  const loc = page.locator(selector).first();
  try {
    await loc.waitFor({ state: 'visible', timeout: 8_000 });
  } catch {
    return false; // 该字段本次不出现（mode/国家差异）
  }
  await loc.click();
  if (sequential) {
    await loc.pressSequentially(value, { delay: 25 });
  } else {
    await loc.fill(value);
  }
  return true;
}

/**
 * 带重试的支付：托管页渲染时序不稳定时，每次尝试都用一个全新的 checkout 会话（由 makeCheckoutUrl 现取）
 * 并配合较短的渲染预算，只要某次渲染成功即返回。
 */
export async function payWithRetry(
  makeCheckoutUrl: () => Promise<string>,
  email: string,
  opts: { attempts: number; renderBudgetMs: number },
): Promise<void> {
  let lastErr: unknown;
  for (let i = 1; i <= opts.attempts; i++) {
    try {
      const url = await makeCheckoutUrl();
      await payHostedCheckout(url, email, opts.renderBudgetMs);
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`payWithRetry 尝试 ${opts.attempts} 次仍失败：${(lastErr as Error)?.message ?? lastErr}`);
}

export async function payHostedCheckout(
  checkoutUrl: string,
  email: string,
  renderBudgetMs = 170_000,
): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    // 用 domcontentloaded：Stripe 页有 hcaptcha/分析等第三方 frame，'load' 可能长时间不触发
    await page.goto(checkoutUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });

    // 就绪闸：托管页渲染较慢。card-only 布局 #cardNumber 会直接出现；
    // 多支付方式布局下 card 表单折叠在手风琴里，点开 card 手风琴按钮（radio 兜底）以展开。
    const cardNumber = page.locator('#cardNumber');
    const cardAccordionBtn = page.locator('[data-testid="card-accordion-item-button"]');
    const cardRadio = page.locator('#payment-method-accordion-item-title-card');
    const deadline = Date.now() + renderBudgetMs;
    let ready = false;
    while (Date.now() < deadline) {
      if (await cardNumber.isVisible().catch(() => false)) {
        ready = true;
        break;
      }
      if (await cardAccordionBtn.isVisible().catch(() => false)) {
        await cardAccordionBtn.click().catch(() => undefined);
      } else if (await cardRadio.isVisible().catch(() => false)) {
        await cardRadio.click().catch(() => undefined);
      }
      await page.waitForTimeout(2_000);
    }
    if (!ready) throw new Error(`Stripe Checkout 卡号字段 ${Math.round(renderBudgetMs / 1000)}s 内未渲染`);

    await typeInto(page, '#email', email, false);
    // 卡字段逐字符输入（数字），让 Stripe 自动格式化 expiry -> "MM / YY"
    await typeInto(page, '#cardNumber', E2E.testCard.number, true);
    await typeInto(page, '#cardExpiry', E2E.testCard.exp.replace(/\D/g, ''), true);
    await typeInto(page, '#cardCvc', E2E.testCard.cvc, true);
    await typeInto(page, '#billingName', E2E.testCard.name, false);
    await typeInto(page, '#phoneNumber', E2E.testCard.phone, false);
    await typeInto(page, '#billingPostalCode', E2E.testCard.zip, false);

    // 必填齐全后按钮才可点：等它脱离 --incomplete 且 enabled
    const submit = page.locator('[data-testid="hosted-payment-submit-button"]');
    await submit.waitFor({ state: 'visible', timeout: 10_000 });
    try {
      await page.waitForFunction(
        () => {
          const b = document.querySelector('[data-testid="hosted-payment-submit-button"]');
          return b && !b.classList.contains('SubmitButton--incomplete') && !(b as HTMLButtonElement).disabled;
        },
        undefined,
        { timeout: 15_000 },
      );
    } catch {
      await page
        .screenshot({ path: path.join(os.tmpdir(), 'autix-e2e-checkout-incomplete.png'), fullPage: true })
        .catch(() => undefined);
      throw new Error('提交按钮未就绪（必填未通过 Stripe 校验），已截图到临时目录');
    }

    await submit.click();
    // 支付提交后 Stripe 跳转 success_url（可能指向未启动的本地页面而导航失败）。
    // 成功判定不依赖此跳转，交给测试对 DB 履约的轮询；这里尽力等它离开 Stripe 页，容忍超时/导航错误。
    await page
      .waitForURL((url) => !url.href.includes('checkout.stripe.com'), { timeout: 90_000 })
      .catch(() => undefined);
    return page.url();
  } finally {
    await browser.close();
  }
}

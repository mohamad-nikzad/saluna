import type { Page } from '@playwright/test'

/** Thin page object: stable selectors + navigation (POM pattern). */
export class LoginPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/auth')
  }

  async submit(phone: string, password: string) {
    const phoneBox = this.page.getByRole('textbox', { name: 'شماره موبایل' })
    const passBox = this.page.getByRole('textbox', { name: 'رمز عبور' })
    await phoneBox.click()
    await phoneBox.fill(phone)
    await passBox.click()
    await passBox.fill(password)
    await this.page.getByRole('button', { name: 'ورود' }).click()
  }
}

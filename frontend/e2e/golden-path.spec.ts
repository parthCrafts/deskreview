import { expect, type Page, test } from '@playwright/test'

/** Use a one-click demo account from the login page. */
async function demoLogin(page: Page, name: string) {
  await page.goto('/login')
  await page.getByRole('button', { name: `Sign in as ${name}` }).click()
}

/** Log out through the user menu. */
async function logout(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(name) }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to DeskReview' })).toBeVisible()
}

test('submitter submits, reviewer approves, submitter sees the decision', async ({ page }) => {
  const title = `E2E policy ${Date.now()}`

  await demoLogin(page, 'Alice Chen')
  await expect(page.getByRole('heading', { name: 'My submissions' })).toBeVisible()
  await page.getByRole('link', { name: 'Submit', exact: true }).click()
  await page.getByLabel('Title', { exact: true }).fill(title)
  await page.getByRole('tab', { name: 'Write text' }).click()
  await page.getByLabel('Text', { exact: true }).fill('Remote work allowed up to three days a week.')
  await page.getByRole('button', { name: 'Submit for review' }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByRole('article').getByText('Pending', { exact: true })).toBeVisible()
  await logout(page, 'Alice Chen')

  await demoLogin(page, 'Rita Shah')
  await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Pending/ })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('searchbox', { name: 'Search documents' }).fill(title)
  await page.getByRole('link', { name: title }).click()
  await page.getByRole('button', { name: /^Approve/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Approve document' }).click()
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible()
  await logout(page, 'Rita Shah')

  await demoLogin(page, 'Alice Chen')
  await page.getByRole('link', { name: title }).click()
  const article = page.getByRole('article')
  await expect(article.getByRole('heading', { name: title })).toBeVisible()
  await expect(article.getByText('Approved by')).toBeVisible()
  const history = article.getByRole('list', { name: 'History' }).getByRole('listitem')
  await expect(history).toHaveCount(2)
  await expect(history.nth(0)).toContainText('Alice Chen submitted')
  await expect(history.nth(1)).toContainText('Rita Shah approved')
  await logout(page, 'Alice Chen')

  // The admin sees the whole trail: who submitted, who reviewed, and everyone's activity.
  await demoLogin(page, 'Avery Morgan')
  await expect(page.getByRole('heading', { name: 'All documents' })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search documents' }).fill(title)
  const row = page.getByRole('row', { name: new RegExp(title) })
  await expect(row).toContainText('Alice Chen')
  await expect(row).toContainText('Approved')
  await expect(row).toContainText('Rita Shah')
  await page.getByRole('link', { name: 'Users', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible()
  await expect(page.getByRole('row', { name: /Rita Shah/ })).toContainText('Reviewer')
})

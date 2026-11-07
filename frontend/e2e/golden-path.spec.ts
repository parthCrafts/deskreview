import { expect, type Page, test } from '@playwright/test'

/** Use a one-click demo account from the login page. */
async function demoLogin(page: Page, group: 'Submitters' | 'Reviewers', name: string) {
  await page.goto('/login')
  await page.getByRole('group', { name: group }).getByRole('button', { name: new RegExp(name) }).click()
}

/** Log out through the user menu. */
async function logout(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(name) }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to DeskReview' })).toBeVisible()
}

test('submitter submits, reviewer approves, submitter sees the decision', async ({ page }) => {
  const title = `E2E policy ${Date.now()}`

  await demoLogin(page, 'Submitters', 'Alice Chen')
  await expect(page.getByRole('heading', { name: 'My submissions' })).toBeVisible()
  await page.getByRole('link', { name: 'Submit', exact: true }).click()
  await page.getByLabel('Title', { exact: true }).fill(title)
  await page.getByRole('tab', { name: 'Write text' }).click()
  await page.getByLabel('Text', { exact: true }).fill('Remote work allowed up to three days a week.')
  await page.getByRole('button', { name: 'Submit for review' }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByRole('article').getByText('Pending', { exact: true })).toBeVisible()
  await logout(page, 'Alice Chen')

  await demoLogin(page, 'Reviewers', 'Rita Shah')
  await expect(page.getByRole('heading', { name: 'Review queue' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Pending/ })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('searchbox', { name: 'Search documents' }).fill(title)
  await page.getByRole('link', { name: title }).click()
  await page.getByRole('button', { name: /^Approve/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Approve document' }).click()
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible()
  await logout(page, 'Rita Shah')

  await demoLogin(page, 'Submitters', 'Alice Chen')
  await page.getByRole('link', { name: title }).click()
  const article = page.getByRole('article')
  await expect(article.getByRole('heading', { name: title })).toBeVisible()
  await expect(article.getByText('Approved by')).toBeVisible()
  const history = article.getByRole('list', { name: 'History' }).getByRole('listitem')
  await expect(history).toHaveCount(2)
  await expect(history.nth(0)).toContainText('Alice Chen submitted')
  await expect(history.nth(1)).toContainText('Rita Shah approved')
})

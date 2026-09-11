import { test, expect, type Page } from '@playwright/test';

const password = 'QarHub-test-password-2026';
const camry = 'Camry 50: откуда стук на мелких неровностях?';
async function register(page: Page, name: string) {
  const email = `test-${crypto.randomUUID()}@example.com`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Присоединиться', exact: true }).click();
  await page.getByRole('textbox', { name: 'Имя или никнейм' }).fill(name);
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByLabel('Повтори пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  return email;
}
async function createQuestion(page: Page, title: string) {
  await page.getByRole('button', { name: 'Задать вопрос', exact: true }).click();
  await page.getByRole('textbox', { name: 'Заголовок' }).fill(title);
  await page
    .getByRole('textbox', { name: 'Подробности' })
    .fill('Хочу узнать, как владельцы ведут историю обслуживания своего автомобиля.');
  await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: title })).toBeVisible();
}

test('guest can search, filter and read, but must sign in to post', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.post-card')).toHaveCount(5);
  await page.getByRole('textbox', { name: 'Поиск по сообществу' }).fill('Camry');
  await expect(page.locator('.post-card')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Фильтр по марке' }).selectOption('BMW');
  await expect(page.getByText('Пока ничего не нашлось')).toBeVisible();
  await page.getByRole('button', { name: 'Показать все публикации' }).click();
  await page.getByRole('button', { name: 'Решённые', exact: true }).click();
  await page.getByRole('button', { name: camry, exact: true }).click();
  await expect(page.getByText('Автор отметил решение')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Задать вопрос', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Создать аккаунт', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Заголовок' })).toHaveCount(0);
});

test('two independent browser sessions share a question, answer and solution', async ({
  page,
  browser,
}) => {
  test.setTimeout(60000);
  await register(page, 'АвторВопроса');
  const title = `Общий вопрос ${crypto.randomUUID().slice(0, 8)}`;
  await createQuestion(page, title);
  const link = page.url();
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5174' });
  try {
    const second = await context.newPage();
    await register(second, 'ДругойВодитель');
    await second.goto(link);
    await expect(second.getByRole('dialog').getByRole('heading', { name: title })).toBeVisible();
    await expect(second.getByText('АвторВопроса · это ты')).toHaveCount(0);
    await second
      .getByRole('textbox', { name: 'Твой ответ' })
      .fill('Сохраняю дату, пробег, список работ и фотографии чеков.');
    await second.getByRole('button', { name: 'Ответить', exact: true }).click();
    await expect(second.locator('.reply')).toHaveCount(1);
    await expect(second.getByRole('button', { name: 'Этот ответ помог' })).toHaveCount(0);
    await page.reload();
    await page.getByRole('button', { name: 'Этот ответ помог' }).click();
    await expect(page.getByText('Автор отметил решение')).toBeVisible();
    await second.reload();
    await expect(second.getByText('Автор отметил решение')).toBeVisible();
    await page.getByRole('button', { name: 'Снять отметку решения' }).click();
    await expect(page.getByText('Автор отметил решение')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('bookmarks, garage and subscriptions follow account across login on another browser', async ({
  page,
  browser,
}) => {
  test.setTimeout(60000);
  const email = await register(page, 'ВладелецBMW');
  const card = page
    .locator('.post-card')
    .filter({ has: page.getByRole('heading', { name: camry, exact: true }) });
  await card.getByRole('button', { name: /^Сохранить:/ }).click();
  await expect(card.getByRole('button', { name: /^Убрать из избранного:/ })).toBeVisible();
  await card.getByRole('button', { name: /^Нравится:/ }).click();
  await expect(card.getByRole('button', { name: /^Нравится:/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Добавить в гараж', exact: true }).click();
  await page.getByRole('combobox', { name: 'Марка', exact: true }).selectOption('BMW');
  await page.getByRole('textbox', { name: 'Модель', exact: true }).fill('E46');
  await page.getByRole('spinbutton', { name: 'Год выпуска' }).fill('2003');
  await page.getByRole('textbox', { name: 'Двигатель и коробка' }).fill('2.5 · МКПП');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Добавить в гараж', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'BMW E46', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Сообщества', exact: true }).click();
  await page.getByRole('button', { name: 'Подписаться на Lexus', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Отписаться от Lexus', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'ВладелецBMW', exact: true }).click();
  await page.getByRole('button', { name: 'Выйти из аккаунта', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Присоединиться', exact: true })).toBeVisible();
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5174' });
  try {
    const next = await context.newPage();
    await next.goto('/');
    await next.getByRole('button', { name: /^Мой гараж/ }).click();
    await expect(next.getByRole('heading', { name: 'BMW E46', exact: true })).toHaveCount(0);
    await next.getByRole('button', { name: 'Присоединиться', exact: true }).click();
    await next.getByRole('button', { name: 'Вход', exact: true }).click();
    await next.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
    await next.getByLabel('Пароль', { exact: true }).fill(password);
    await next.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(next.getByRole('heading', { name: 'BMW E46', exact: true })).toBeVisible();
    await next.getByRole('button', { name: /^Избранное/ }).click();
    await expect(next.locator('.post-card')).toHaveCount(1);
    await next.getByRole('button', { name: /^Убрать из избранного:/ }).click();
    await expect(next.getByText('Сохрани то, что пригодится')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('registration validates confirmation; server errors preserve form input', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Присоединиться', exact: true }).click();
  await page.getByRole('textbox', { name: 'Имя или никнейм' }).fill('ПроверкаФормы');
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(`form-${crypto.randomUUID()}@example.com`);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByLabel('Повтори пароль', { exact: true }).fill('different-password');
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await expect(page.getByText('Пароли не совпадают.')).toBeVisible();
  await page.getByLabel('Повтори пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ПроверкаФормы', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Задать вопрос', exact: true }).click();
  await page.getByRole('textbox', { name: 'Заголовок' }).fill('Мой текст не должен потеряться');
  await page
    .getByRole('textbox', { name: 'Подробности' })
    .fill('Подробное описание проблемы останется в форме при потере соединения.');
  await page.route('**/api/posts', (route) => route.abort());
  await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Нет связи с сервером');
  await expect(page.getByRole('textbox', { name: 'Заголовок' })).toHaveValue(
    'Мой текст не должен потеряться',
  );
});

test('journal creation and author profile rename work through the server', async ({ page }) => {
  await register(page, 'АвторИстории');
  await page.getByRole('button', { name: 'Бортжурналы', exact: true }).click();
  await page.getByRole('button', { name: 'Написать историю', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Тип публикации' })).toHaveValue('journal');
  await page
    .getByRole('textbox', { name: 'Заголовок' })
    .fill('Мой серверный бортжурнал автомобиля');
  await page
    .getByRole('textbox', { name: 'Подробности' })
    .fill('Сегодня начал собирать историю обслуживания и записывать все работы.');
  await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Мой серверный бортжурнал автомобиля' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'АвторИстории', exact: true }).click();
  await page.getByRole('textbox', { name: 'Имя или никнейм' }).fill('ОбновлённыйАвтор');
  await page.getByRole('button', { name: 'Сохранить профиль', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ОбновлённыйАвтор', exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page
      .locator('.post-card')
      .filter({
        has: page.getByRole('heading', {
          name: 'Мой серверный бортжурнал автомобиля',
          exact: true,
        }),
      }),
  ).toContainText('ОбновлённыйАвтор');
});

test('mobile navigation and registration fit narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.post-card').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('textbox', { name: 'Поиск по сообществу' }).fill('E46');
  await expect(page.locator('.post-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.getByRole('button', { name: 'Сообщества', exact: true }).click();
  await expect(page.locator('.community-card')).toHaveCount(9);
  await page.getByRole('button', { name: 'Присоединиться', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .getByRole('dialog')
    .screenshot({ path: '.artifacts/day2-mobile-auth.png', animations: 'disabled' });
  expect(await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('old browser data cannot spoof identity and unknown topics can close', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'qarhub:v1',
      JSON.stringify({ name: 'ПоддельныйАвтор', user: { id: 'admin' } }),
    ),
  );
  await page.goto('/?post=missing');
  await expect(page.getByRole('heading', { name: 'Обсуждение не найдено' })).toBeVisible();
  await page.getByRole('button', { name: 'К ленте', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Присоединиться', exact: true })).toBeVisible();
});

test('server-backed desktop and mobile have no script errors or broken images', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.post-card').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page
        .locator('img')
        .evaluateAll((images) =>
          images.every(
            (img) => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page.screenshot({
    path: '.artifacts/day2-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: '.artifacts/day2-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});

import { test, expect } from '@playwright/test';

test('search, filters, empty results and reset', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Свои люди. Общий драйв.' })).toBeVisible();
  await expect(page.locator('.post-card')).toHaveCount(5);
  await page.getByRole('textbox', { name: 'Поиск по сообществу' }).fill('Camry');
  await expect(page.locator('.post-card')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Фильтр по марке' }).selectOption('BMW');
  await expect(page.getByText('Пока ничего не нашлось')).toBeVisible();
  await page.getByRole('button', { name: 'Показать все публикации' }).click();
  await expect(page.locator('.post-card')).toHaveCount(5);
  await page.getByRole('button', { name: 'Решённые', exact: true }).click();
  await expect(page.locator('.post-card')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Camry 50: откуда стук на мелких неровностях?', exact: true })
    .click();
  await expect(page.getByText('Автор отметил решение')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('create question, reply, mark solution and persist across reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Присоединиться', exact: true }).click();
  await page.getByRole('textbox', { name: 'Имя или никнейм' }).fill('QarTester');
  await page.getByRole('button', { name: 'Поехали', exact: true }).click();
  await page.getByRole('button', { name: 'Задать вопрос', exact: true }).click();
  await page.getByRole('textbox', { name: 'Заголовок' }).fill('Проверка нового вопроса QarHub');
  await page
    .getByRole('textbox', { name: 'Подробности' })
    .fill('Хочу узнать, как владельцы ведут историю обслуживания своего автомобиля.');
  await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Проверка нового вопроса QarHub' }),
  ).toBeVisible();
  await expect(page.getByText('QarTester · это ты')).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Твой ответ' })
    .fill('Сохраняю дату, пробег, список работ и фотографии чеков.');
  await page.getByRole('button', { name: 'Ответить', exact: true }).click();
  await page.getByRole('button', { name: 'Этот ответ помог' }).click();
  await expect(page.getByText('Автор отметил решение')).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Проверка нового вопроса QarHub' }),
  ).toBeVisible();
  await expect(page.getByText('Автор отметил решение')).toBeVisible();
  await page.getByRole('button', { name: 'Снять отметку решения' }).click();
  await expect(page.getByText('Автор отметил решение')).toHaveCount(0);
});

test('bookmark and like are persistent and reversible', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('.post-card').first();
  await card.getByRole('button', { name: /^Нравится:/ }).click();
  await expect(card.getByRole('button', { name: /^Нравится:/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await card.getByRole('button', { name: /^Сохранить:/ }).click();
  await page.reload();
  await expect(
    page
      .locator('.post-card')
      .first()
      .getByRole('button', { name: /^Нравится:/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^Избранное/ }).click();
  await expect(page.locator('.post-card')).toHaveCount(1);
  await page.getByRole('button', { name: /^Убрать из избранного:/ }).click();
  await expect(page.getByText('Сохрани то, что пригодится')).toBeVisible();
});

test('garage saves vehicle and opens its community', async ({ page }) => {
  await page.goto('/');
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
  await page.reload();
  await page.getByRole('button', { name: /^Мой гараж/ }).click();
  await expect(page.getByRole('heading', { name: 'BMW E46', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Обсуждения BMW' }).click();
  await expect(page.locator('.post-card')).toHaveCount(1);
  await expect(page.getByRole('combobox', { name: 'Фильтр по марке' })).toHaveValue('BMW');
});

test('community subscription and journal creation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Сообщества', exact: true }).click();
  await page.getByRole('button', { name: 'Подписаться на Lexus', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Отписаться от Lexus', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Бортжурналы', exact: true }).click();
  await expect(page.locator('.post-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Написать историю', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Тип публикации' })).toHaveValue('journal');
  await page.getByRole('textbox', { name: 'Заголовок' }).fill('Моя первая запись в бортжурнал');
  await page
    .getByRole('textbox', { name: 'Подробности' })
    .fill('Сегодня начал собирать историю обслуживания и записывать все работы.');
  await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Бортжурналы', exact: true }).click();
  await expect(page.locator('.post-card')).toHaveCount(3);
});

test('mobile navigation, search, modal and layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('textbox', { name: 'Поиск по сообществу' }).fill('E46');
  await expect(page.locator('.post-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.getByRole('button', { name: 'Сообщества', exact: true }).click();
  await expect(page.locator('.community-card')).toHaveCount(9);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.getByRole('button', { name: /^Мой гараж/ }).click();
  await page.getByRole('button', { name: 'Добавить первый автомобиль' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('invalid stored data falls back safely, unknown topic can close', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('qarhub:v1', '{broken'));
  await page.goto('/?post=missing');
  await expect(page.getByRole('heading', { name: 'Обсуждение не найдено' })).toBeVisible();
  await page.getByRole('button', { name: 'К ленте', exact: true }).click();
  await expect(page.locator('.post-card')).toHaveCount(5);
});

test('desktop and mobile screenshots, no script errors or broken images', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.hero-image')).toBeVisible();
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
    path: '.artifacts/qarhub-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: '.artifacts/qarhub-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});

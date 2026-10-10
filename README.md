# Тектоника — корпоративный сайт (демо-заглушка)

Многостраничный корпоративный сайт инженерно-строительной группы. Компания, тексты, цифры и отзывы условные — заменяются на данные клиента.

Демо: https://daviddavidso.github.io/tektonika/

## Что внутри

- 37 статических страниц: главная, о компании, 6 направлений, 8 проектов, принципы, вопросы и ответы, отзывы, журнал (рубрики + 6 статей), контакты, документы и 4 правовые страницы, 404.
- SEO: у каждой страницы свой адрес, title, description, canonical, Open Graph; разметка schema.org (Organization, BreadcrumbList, Service, FAQPage, Article/NewsArticle, GeneralContractor); sitemap.xml и robots.txt генерируются автоматически.
- Без фреймворков и зависимостей: `build.mjs` собирает HTML из `content.mjs` и `articles.mjs`, стили и скрипт лежат в `src/`.
- Шрифт Geist (OFL) и иконки Tabler (MIT) встроены; фото — Unsplash.

## Сборка

```bash
node build.mjs
```

Переменные: `BASE` (путь сайта, по умолчанию `/tektonika/`), `ORIGIN` (домен для canonical и sitemap), `NOINDEX` (`1` — запрет индексации, для демо; `0` — боевой режим).

Боевая сборка на своём домене:

```bash
BASE=/ ORIGIN=https://example.ru NOINDEX=0 node build.mjs
```

## Выкладка демо

```bash
./deploy.sh
```

## Где править

- Тексты компании, направления, проекты, отзывы, вопросы: `content.mjs`
- Статьи и новости: `articles.mjs` (в ссылках `@/` = корень сайта)
- Шаблоны страниц: `build.mjs`
- Оформление: `src/style.css`, поведение: `src/app.js`

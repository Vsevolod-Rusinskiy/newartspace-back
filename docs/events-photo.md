# Event Photos Implementation Plan

## Detailed task description
Добавление функционала множественных фотографий для событий.
Реализация будет разбита на этапы для обеспечения стабильности и тестируемости.

## Progress
🟩🟩🟩🟩⬜⬜⬜⬜⬜⬜ 40%

---

## Task Statuses
- ⏳ — In progress
- ✅ — Done
- ❌ — Not done

## Stage 1: Basic Photo Storage Structure
✅ 1.1. Database Setup
- ✅ Создать миграцию для таблицы event_photos
  ```typescript
  fields: {
    id: number
    imgUrl: string
    title: string
    priority: number
    createdAt: date
    updatedAt: date
  }
  ```
- ✅ Запустить миграцию
- ✅ Проверить создание таблицы

✅ 1.2. Model Creation
- ✅ Создать модель EventPhoto
- ✅ Добавить базовые поля
- ⏸️ Протестировать создание записей (отложено до админки)

✅ 1.3. Basic API
- ✅ Создать EventPhotosModule
- ✅ Создать EventPhotosService с базовым CRUD
- ✅ Создать EventPhotosController
- ✅ Настроить роуты:
  - GET /event-photos
  - POST /event-photos
  - DELETE /event-photos/:id
- ✅ Добавить модуль в app.module.ts
- ⏸️ Протестировать API endpoints (отложено до админки)

## Stage 2: Admin Panel Integration
⏳ 2.1. Admin Menu
- ❌ Добавить пункт меню "Фото событий"
- ❌ Создать базовый компонент страницы

❌ 2.2. Photo Management Interface
- ❌ Создать grid для отображения фото
- ❌ Добавить форму загрузки
- ❌ Добавить функционал удаления
- ❌ Добавить поле title
- ❌ Добавить поле priority

❌ 2.3. Testing
- ❌ Протестировать загрузку фото
- ❌ Протестировать отображение
- ❌ Протестировать удаление
- ❌ Протестировать сортировку

## Stage 3: Event Integration
❌ 3.1. Database Relations
- ❌ Создать миграцию для связующей таблицы event_to_photos
- ❌ Обновить модели для связи многие-ко-многим
- ❌ Запустить миграцию

❌ 3.2. API Updates
- ❌ Обновить EventService для работы с фото
- ❌ Добавить методы связывания фото с событием
- ❌ Обновить методы получения события с фото

❌ 3.3. Admin Interface Updates
- ❌ Добавить выбор фото в форму события
- ❌ Добавить превью выбранных фото
- ❌ Добавить сортировку фото для события

❌ 3.4. Testing
- ❌ Протестировать связь события с фото
- ❌ Протестировать отображение фото в событии
- ❌ Протестировать удаление связей

## Stage 4: Optimizations and Improvements
❌ 4.1. UX Improvements
- ❌ Добавить drag-n-drop для загрузки
- ❌ Добавить превью при загрузке
- ❌ Улучшить grid отображение

❌ 4.2. Performance
- ❌ Оптимизировать загрузку фото
- ❌ Добавить кэширование
- ❌ Оптимизировать запросы к БД

❌ 4.3. Final Testing
- ❌ Нагрузочное тестирование
- ❌ UI/UX тестирование
- ❌ Проверка производительности

## Notes
- Каждый этап должен быть протестирован перед переходом к следующему
- Все изменения должны быть задокументированы
- Создавать отдельные ветки для каждого этапа

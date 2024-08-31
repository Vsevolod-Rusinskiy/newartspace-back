# Этап 1: Сборка
FROM node:20.9.0-alpine AS builder

# Создаем рабочую директорию
WORKDIR /app

# Копируем файл package.json и yarn.lock
COPY package.json yarn.lock ./

# Устанавливаем зависимости
RUN yarn install --frozen-lockfile

# Копируем остальные файлы проекта
COPY . .

# Выводим текущий путь
# RUN pwd

# Выводим список файлов, чтобы убедиться, что .env файл скопирован
# RUN ls -la

# Применяем миграции базы данных
# yarn sequelize-cli db:migrate --config src/config/config.js

# Компилируем код
RUN yarn build

# Этап 2: Продакшн
FROM node:20.9.0-alpine

# Создаем рабочую директорию
WORKDIR /app

# Копируем только необходимые файлы из builder-а
COPY --from=builder /app/package.json /app/yarn.lock ./
COPY --from=builder /app/dist ./dist

# Устанавливаем только production-зависимости
RUN yarn install --frozen-lockfile --production

# Указываем команду для запуска приложения
CMD ["yarn", "start:prod"]

# Указываем, что контейнер будет слушать порт 3000
EXPOSE 3000

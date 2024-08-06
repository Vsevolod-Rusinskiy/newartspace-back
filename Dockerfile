# Используем Node.js как базовый образ
FROM node:20.9.0-alpine

# Создаем рабочую директорию
WORKDIR /app

# Копируем файл package.json и yarn.lock
COPY package.json yarn.lock ./

# Устанавливаем зависимости
RUN yarn install --frozen-lockfile

# Копируем остальные файлы проекта
COPY . .

# Компилируем код
RUN yarn build

# Указываем команду для запуска приложения
CMD ["yarn", "start:prod"]

# Указываем, что контейнер будет слушать порт 3000
EXPOSE 3000

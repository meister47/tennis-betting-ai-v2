#!/bin/bash

# Скрипт для проверки Git статуса и пуша

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Проверка Git статуса репозитория Tennis Betting AI ===${NC}\n"

# Проверяем Git конфигурацию
echo -e "${BLUE}📊 Git конфигурация:${NC}"
git config --get remote.origin.url
echo ""

# Проверяем статус
echo -e "${BLUE}📋 Git статус:${NC}"
git status --short
echo ""

# Проверяем историю коммитов
echo -e "${BLUE}📜 Последние коммиты:${NC}"
git log --oneline -5
echo ""

# Проверяем разницу с origin
echo -e "${BLUE}📤 Сравнение с origin:${NC}"
git log --oneline origin/master..HEAD
echo ""

# Если есть изменения для пуша
if git status | grep -q "Your branch is ahead"; then
    echo -e "${GREEN}✅ Есть коммиты для пуша${NC}"
    echo ""
    echo -e "${BLUE}🚀 Запуск git push...${NC}"
    if git push; then
        echo -e "\n${GREEN}✅ Push успешно выполнен!${NC}"
        echo -e "${GREEN}🎉 Все изменения залиты в Git${NC}"
    else
        echo -e "\n${RED}❌ Ошибка при пуше${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Все коммиты уже залиты в Git${NC}"
    echo -e "${GREEN}📦 Репозиторий синхронизирован${NC}"
fi

echo ""
echo -e "${BLUE}📊 Сводка:${NC}"
echo "Репозиторий: $(git config --get remote.origin.url)"
echo "Текущая ветка: $(git branch --show-current)"
echo "Последний коммит: $(git log -1 --oneline --no-decorate)"
echo ""

# Дополнительная проверка токенов
echo -e "${BLUE}🔒 Проверка безопасности токенов:${NC}"
if grep -r "TELEGRAM_BOT_TOKEN\|TELEGRAM_CHAT_ID" --include="*.js" --include="*.json" --include="*.md" . | grep -v "TELEGRAM_BOT_TOKEN=.*\|TELEGRAM_CHAT_ID=.*" | grep -v ".env.example"; then
    echo -e "${RED}⚠️  ВНИМАНИЕ: Возможно найден токен в коде! Проверьте файлы.${NC}"
    echo ""
    echo "Файлы, требующие проверки:"
    grep -r "TELEGRAM_BOT_TOKEN\|TELEGRAM_CHAT_ID" --include="*.js" --include="*.json" --include="*.md" . | grep -v "TELEGRAM_BOT_TOKEN=.*\|TELEGRAM_CHAT_ID=.*" | grep -v ".env.example" | cut -d: -f1 | sort -u
else
    echo -e "${GREEN}✅ Токены не найдены в коде (безопасно)${NC}"
fi

echo ""
echo -e "${BLUE}✅ Проверка завершена${NC}"
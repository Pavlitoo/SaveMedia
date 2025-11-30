require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
// Імпортуємо бібліотеку для скачування
const { CobaltApi } = require("cobalt-api");

// --- ПЕРЕВІРКИ ---
if (!process.env.BOT_TOKEN) {
  console.error('❌ ПОМИЛКА: Токен бота відсутній!');
  process.exit(1);
}

// --- ІНІЦІАЛІЗАЦІЯ ---
const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
const PORT = process.env.PORT || 3000;
// Створюємо екземпляр завантажувача
const cobalt = new CobaltApi();

app.use(cors());
app.use(express.json());

// --- ЛОГІКА БОТА ---
bot.start((ctx) => {
  ctx.reply(
    'Привіт! Я SaveMedia Бот. 🚀\n\nЩоб скачати відео, натисни кнопку нижче 👇',
    // УВАГА: Переконайся, що тут стоїть ТВОЄ посилання на Vercel!
    Markup.keyboard([
      Markup.button.webApp('Відкрити Додаток 📱', 'https://save-media-fog3.vercel.app/')
    ]).resize()
  );
});

bot.help((ctx) => ctx.reply('Натисни кнопку меню, встав посилання, і я скачаю відео.'));


// --- ЛОГІКА СЕРВЕРА (API) ---

// Головний маршрут - сюди стукається React-додаток
app.post('/download', async (req, res) => {
  const { url, chatId } = req.body;

  console.log(`📥 Отримано запит на скачування: ${url} для юзера ${chatId}`);

  if (!url || !chatId) {
    return res.status(400).json({ success: false, message: 'Немає посилання або ID чату' });
  }

  try {
    // 1. Повідомляємо юзеру в чат, що процес пішов
    await bot.telegram.sendMessage(chatId, '🔍 Шукаю відео, зачекайте секундочку...');

    // 2. Використовуємо бібліотеку cobalt для отримання прямого посилання
    const result = await cobalt.generate(url);

    if (!result || (result.status !== 'success' && result.status !== 'stream')) {
         throw new Error(result.text || 'Не вдалося знайти відео за цим посиланням.');
    }
    
    const videoUrl = result.url;
    console.log(`✅ Відео знайдено! URL: ${videoUrl.substring(0, 50)}...`);
    
    // 3. Відправляємо відео в Телеграм
    await bot.telegram.sendVideo(chatId, videoUrl, {
        caption: 'Відео скачано за допомогою @SaveMedia_bot 🚀'
    });

    console.log(`📤 Відео успішно відправлено юзеру ${chatId}`);
    
    // 4. Відповідаємо Фронтенду, що все добре
    res.json({ success: true });

  } catch (error) {
    console.error('❌ Помилка скачування:', error.message);
    // Повідомляємо помилку в чат і на фронтенд
    bot.telegram.sendMessage(chatId, `⚠️ Вибачте, сталася помилка: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});


// Проста перевірка
app.get('/', (req, res) => res.send('Сервер SaveMedia працює і готовий качати! 🤖'));

// --- ЗАПУСК ---

// Спочатку запускаємо бота
bot.launch().then(() => {
    console.log('✅ Бот успішно запущений в Телеграмі!');
    // Потім запускаємо сервер
    app.listen(PORT, () => {
        console.log(`✅ Сервер API запущений на порті ${PORT}`);
    });
});

// Чемне завершення
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
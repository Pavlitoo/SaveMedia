// --- ІМПОРТИ БІБЛІОТЕК ---
const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const cors = require('cors');

// --- ПЕРЕВІРКА ТОКЕНА ---
if (!process.env.BOT_TOKEN) {
  console.error('❌ ПОМИЛКА: Відсутній BOT_TOKEN в змінних середовища!');
  process.exit(1);
}

console.log('✅ BOT_TOKEN знайдено');

// --- ІНІЦІАЛІЗАЦІЯ ---
const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Дозволяємо запити з твого сайту на Vercel
app.use(express.json()); // Вчимо сервер розуміти JSON дані

// --- ЛОГІКА БОТА ---
bot.start((ctx) => {
  ctx.reply(
    '👋 Привіт! Я SaveMedia Бот. 🚀\n\n' +
    '📱 Я можу скачати відео з:\n' +
    '✅ TikTok\n' +
    '✅ YouTube\n' +
    '✅ Instagram\n' +
    '✅ Twitter/X\n' +
    '✅ Facebook\n' +
    '✅ та багато іншого!\n\n' +
    '🎬 Просто натисни кнопку "Скачати Відео 🚀", вставь посилання, і я скачаю його для тебе!'
  );
});

bot.help((ctx) => {
  ctx.reply(
    '📖 Як це працює:\n\n' +
    '1️⃣ Натисни на кнопку "Скачати Відео 🚀"\n' +
    '2️⃣ Вклей посилання на відео\n' +
    '3️⃣ Чекай, поки відео буде готово\n\n' +
    '⏱️ Процес займає 5-30 секунд\n' +
    '🎥 Файл приходить без водяних знаків\n' +
    '📶 Для лучшої якості використовуй Wi-Fi\n\n' +
    '❓ Якщо у тебе є питання - напиши в техпідтримку!'
  );
});


// --- ДОПОМІЖНІ ФУНКЦІЇ ---

// Виявлення платформи за посиланням
function detectPlatform(url) {
  if (url.includes('tiktok.com') || url.includes('vt.tiktok.com')) return 'tiktok';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('instagram.com') || url.includes('instagr.am')) return 'instagram';
  if (url.includes('x.com') || url.includes('twitter.com')) return 'twitter';
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
  if (url.includes('threads.net')) return 'threads';
  if (url.includes('reddit.com')) return 'reddit';
  if (url.includes('snapchat.com')) return 'snapchat';
  return 'unknown';
}

// TikTok завантажувач
async function downloadTikTok(url) {
  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
    const response = await fetch(apiUrl);
    const result = await response.json();

    if (result.code !== 0 || !result.data) {
      throw new Error('TikTok: Не вдалося знайти відео');
    }

    const videoUrl = result.data.hdplay || result.data.play;
    if (!videoUrl) throw new Error('TikTok: Не вдалося отримати посилання на відео');

    return { success: true, videoUrl, platform: 'TikTok' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// YouTube завантажувач
async function downloadYouTube(url) {
  try {
    const apiUrl = `https://youtube-mp4.vercel.app/api/download?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl);
    const result = await response.json();

    if (!result.success || !result.videoUrl) {
      throw new Error('YouTube: Не вдалося знайти відео');
    }

    return { success: true, videoUrl: result.videoUrl, platform: 'YouTube' };
  } catch (error) {
    try {
      const altUrl = `https://www.youtubeinmp4.com/fetch?video_url=${encodeURIComponent(url)}`;
      const altResponse = await fetch(altUrl);
      const altResult = await altResponse.json();

      if (altResult.status === 200 && altResult.link) {
        return { success: true, videoUrl: altResult.link, platform: 'YouTube' };
      }
    } catch (altError) {
      console.error('Альтернативний YouTube API також не спрацював');
    }
    return { success: false, error: 'YouTube: ' + error.message };
  }
}

// Instagram завантажувач
async function downloadInstagram(url) {
  try {
    const apiUrl = `https://www.instagram.com/p/`;
    const videoId = url.match(/\/p\/([^/?]+)/)?.[1];

    if (!videoId) throw new Error('Instagram: Невірне посилання');

    const instaApi = `https://api.instasave.net/v1/source?url=${encodeURIComponent(url)}`;
    const response = await fetch(instaApi);
    const result = await response.json();

    if (!result.status || !result.data?.url) {
      throw new Error('Instagram: Не вдалося знайти відео');
    }

    return { success: true, videoUrl: result.data.url, platform: 'Instagram' };
  } catch (error) {
    return { success: false, error: 'Instagram: ' + error.message };
  }
}

// Twitter/X завантажувач
async function downloadTwitter(url) {
  try {
    const tweetId = url.match(/\/status\/(\d+)/)?.[1];
    if (!tweetId) throw new Error('Twitter: Невірне посилання');

    const apiUrl = `https://api.vxtwitter.com/api/video?tweetId=${tweetId}`;
    const response = await fetch(apiUrl);
    const result = await response.json();

    if (!result.url) throw new Error('Twitter: Не вдалося знайти відео');

    return { success: true, videoUrl: result.url, platform: 'Twitter/X' };
  } catch (error) {
    return { success: false, error: 'Twitter: ' + error.message };
  }
}

// Універсальний завантажувач (резервний варіант для інших платформ)
async function downloadUniversal(url) {
  try {
    const apiUrl = `https://ssyoutube.com/api/convert?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl);
    const result = await response.json();

    if (!result.status || !result.URL) throw new Error('Не вдалося знайти відео');

    return { success: true, videoUrl: result.URL, platform: 'Гарячий сервіс' };
  } catch (error) {
    return { success: false, error: 'Універсальний API: ' + error.message };
  }
}

// Основна логіка завантаження за платформою
async function downloadVideo(url) {
  const platform = detectPlatform(url);

  console.log(`🔍 Виявлена платформа: ${platform}`);

  switch (platform) {
    case 'tiktok':
      return await downloadTikTok(url);
    case 'youtube':
      return await downloadYouTube(url);
    case 'instagram':
      return await downloadInstagram(url);
    case 'twitter':
    case 'x':
      return await downloadTwitter(url);
    default:
      return await downloadUniversal(url);
  }
}

// --- ЛОГІКА СЕРВЕРА (API) ---

// Головний маршрут - сюди стукається React-додаток з кнопкою "Скачати"
app.post('/download', async (req, res) => {
  const { url, chatId } = req.body;

  console.log(`📥 Отримано запит на скачування: ${url} для юзера ${chatId}`);

  if (!url || !chatId) {
    return res.status(400).json({ success: false, message: 'Немає посилання або ID чату' });
  }

  try {
    await bot.telegram.sendMessage(chatId, '🔍 Шукаю відео, зачекайте секундочку...');

    const result = await downloadVideo(url);

    if (!result.success) {
      throw new Error(result.error || 'Не вдалося скачати відео');
    }

    console.log(`📹 Відео отримано з ${result.platform}!`);

    await bot.telegram.sendVideo(chatId, result.videoUrl, {
        caption: `✅ Відео скачано з ${result.platform}!\n🚀 За допомогою @SaveMedia_bot`
    });

    console.log(`📤 Відео успішно відправлено юзеру ${chatId}`);

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Помилка під час скачування:', error.message);

    try {
        await bot.telegram.sendMessage(chatId, `⚠️ Помилка: ${error.message}\n\nПідтримувані платформи: TikTok, YouTube, Instagram, Twitter, Facebook та інші.`);
    } catch (telegramError) {
        console.error('Не вдалося відправити повідомлення про помилку в Телеграм:', telegramError.message);
    }

    res.status(500).json({ success: false, message: error.message });
  }
});


// Проста перевірка, чи сервер живий (для браузера)
app.get('/', (_, res) => res.send('Сервер SaveMedia працює і готовий качати! 🤖'));

// --- ЗАПУСК ---

// Обробка помилок при запуску
process.on('uncaughtException', (error) => {
  console.error('❌ Необроблена помилка:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Необроблене відхилення промісу:', reason);
  process.exit(1);
});

// Спочатку запускаємо сервер API
app.listen(PORT, () => {
    console.log(`✅ Сервер API запущений на порті ${PORT}`);
});

// Потім запускаємо бота
bot.launch()
  .then(() => {
    console.log('✅ Бот успішно запущений в Телеграмі!');
  })
  .catch((error) => {
    console.error('❌ Помилка при запуску бота:', error);
    process.exit(1);
  });

// Чемне завершення роботи
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
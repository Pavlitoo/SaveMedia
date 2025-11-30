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

app.use(cors());
app.use(express.json());

// --- ЛОГІКА БОТА ---
bot.start((ctx) => {
  ctx.reply(
    '👋 Привіт! Я SaveMedia Бот. 🚀\n\n' +
    '📱 Я можу скачати відео з:\n' +
    '✅ TikTok\n' +
    '✅ Instagram (Reels, Posts, Stories)\n' +
    '✅ YouTube (Shorts & Videos)\n' +
    '✅ Twitter/X\n' +
    '✅ Facebook\n' +
    '✅ та багато іншого!\n\n' +
    '🎬 Просто натисни кнопку меню і вставь посилання!',
    Markup.keyboard([
      Markup.button.webApp('📥 Скачати Відео', 'https://save-media-fog3.vercel.app/')
    ]).resize()
  );
});

bot.help((ctx) => {
  ctx.reply(
    '📖 Як це працює:\n\n' +
    '1️⃣ Натисни кнопку "📥 Скачати Відео"\n' +
    '2️⃣ Вклей посилання на відео\n' +
    '3️⃣ Чекай, поки відео буде готово\n\n' +
    '⏱️ Процес займає 5-30 секунд\n' +
    '🎥 Файл приходить без водяних знаків\n\n' +
    '❓ Проблеми? Напиши в підтримку!'
  );
});

// --- ДОПОМІЖНІ ФУНКЦІЇ ---

function detectPlatform(url) {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('tiktok.com') || urlLower.includes('vt.tiktok')) return 'tiktok';
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
  if (urlLower.includes('instagram.com') || urlLower.includes('instagr.am')) return 'instagram';
  if (urlLower.includes('x.com') || urlLower.includes('twitter.com')) return 'twitter';
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch') || urlLower.includes('fb.com')) return 'facebook';
  if (urlLower.includes('reddit.com')) return 'reddit';
  if (urlLower.includes('pinterest.com')) return 'pinterest';
  if (urlLower.includes('vimeo.com')) return 'vimeo';
  return 'unknown';
}

// TikTok - ПРАЦЮЄ ✅
async function downloadTikTok(url) {
  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
    const response = await fetch(apiUrl);
    const result = await response.json();

    if (result.code !== 0 || !result.data) {
      throw new Error('Не вдалося знайти TikTok відео');
    }

    const videoUrl = result.data.hdplay || result.data.play;
    if (!videoUrl) throw new Error('Не вдалося отримати посилання');

    return { success: true, videoUrl, platform: 'TikTok' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Instagram - ОНОВЛЕНИЙ API ✅
async function downloadInstagram(url) {
  try {
    // Використовуємо Insta Downloader API
    const apiUrl = `https://v3.saveig.app/api/ajaxSearch`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `q=${encodeURIComponent(url)}&t=media&lang=en`
    });

    const result = await response.json();

    if (result.status !== 'ok' || !result.data) {
      throw new Error('Не вдалося знайти Instagram відео');
    }

    // Парсимо HTML відповідь для отримання посилання
    const downloadMatch = result.data.match(/href="([^"]+)".*?download/i);
    if (!downloadMatch) throw new Error('Не вдалося отримати посилання на відео');

    const videoUrl = downloadMatch[1];
    return { success: true, videoUrl, platform: 'Instagram' };
  } catch (error) {
    // Альтернативний API
    try {
      const altUrl = `https://api.downloadgram.com/media?url=${encodeURIComponent(url)}`;
      const altResponse = await fetch(altUrl);
      const altResult = await altResponse.json();

      if (altResult.video_url) {
        return { success: true, videoUrl: altResult.video_url, platform: 'Instagram' };
      }
    } catch (e) {}
    
    return { success: false, error: 'Instagram: ' + error.message };
  }
}

// YouTube - НОВИЙ РОБОЧИЙ API ✅
async function downloadYouTube(url) {
  try {
    // Витягуємо ID відео
    const videoId = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([^&\n?#]+)/)?.[1];
    if (!videoId) throw new Error('Невірне посилання на YouTube');

    // Використовуємо Y2Mate API
    const apiUrl = `https://www.y2mate.com/mates/analyzeV2/ajax`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `k_query=${encodeURIComponent(url)}&k_page=home&hl=en&q_auto=0`
    });

    const result = await response.json();

    if (result.status !== 'ok' || !result.links?.mp4) {
      throw new Error('Не вдалося обробити YouTube відео');
    }

    // Беремо найкращу доступну якість
    const qualities = Object.keys(result.links.mp4);
    const bestQuality = qualities[0]; // Перша - найкраща якість
    const videoData = result.links.mp4[bestQuality];

    // Отримуємо фінальне посилання для завантаження
    const convertResponse = await fetch('https://www.y2mate.com/mates/convertV2/index', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `vid=${videoId}&k=${videoData.k}`
    });

    const convertResult = await convertResponse.json();
    
    if (!convertResult.dlink) throw new Error('Не вдалося отримати посилання');

    return { success: true, videoUrl: convertResult.dlink, platform: 'YouTube' };
  } catch (error) {
    return { success: false, error: 'YouTube: ' + error.message };
  }
}

// Twitter/X - ОНОВЛЕНИЙ ✅
async function downloadTwitter(url) {
  try {
    // Використовуємо FixUpX (vxTwitter) API
    const modifiedUrl = url.replace('twitter.com', 'vxtwitter.com').replace('x.com', 'vxtwitter.com');
    
    const response = await fetch(modifiedUrl);
    const html = await response.text();

    // Шукаємо пряме посилання на відео
    const videoMatch = html.match(/<meta property="og:video" content="([^"]+)"/);
    if (!videoMatch) throw new Error('Не вдалося знайти Twitter відео');

    return { success: true, videoUrl: videoMatch[1], platform: 'Twitter/X' };
  } catch (error) {
    return { success: false, error: 'Twitter: ' + error.message };
  }
}

// Facebook - НОВИЙ API ✅
async function downloadFacebook(url) {
  try {
    const apiUrl = `https://www.getfbstuff.com/api/video?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(apiUrl);
    const result = await response.json();

    if (!result.success || !result.video_url) {
      throw new Error('Не вдалося знайти Facebook відео');
    }

    return { success: true, videoUrl: result.video_url, platform: 'Facebook' };
  } catch (error) {
    return { success: false, error: 'Facebook: ' + error.message };
  }
}

// Універсальний завантажувач через AllVideoDownloader
async function downloadUniversal(url) {
  try {
    const apiUrl = `https://api.allvideodownloader.cc/api/get-video-info`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: url })
    });

    const result = await response.json();

    if (!result.success || !result.url) {
      throw new Error('Не вдалося завантажити відео');
    }

    return { success: true, videoUrl: result.url, platform: 'Відео' };
  } catch (error) {
    return { success: false, error: 'Універсальний API: ' + error.message };
  }
}

// Основна логіка
async function downloadVideo(url) {
  const platform = detectPlatform(url);
  console.log(`🔍 Платформа: ${platform}`);

  switch (platform) {
    case 'tiktok':
      return await downloadTikTok(url);
    case 'instagram':
      return await downloadInstagram(url);
    case 'youtube':
      return await downloadYouTube(url);
    case 'twitter':
      return await downloadTwitter(url);
    case 'facebook':
      return await downloadFacebook(url);
    default:
      return await downloadUniversal(url);
  }
}

// --- API ENDPOINT ---
app.post('/download', async (req, res) => {
  const { url, chatId } = req.body;

  console.log(`📥 Запит: ${url} (user: ${chatId})`);

  if (!url || !chatId) {
    return res.status(400).json({ success: false, message: 'Немає посилання або ID' });
  }

  try {
    await bot.telegram.sendMessage(chatId, '🔍 Шукаю відео...');

    const result = await downloadVideo(url);

    if (!result.success) {
      throw new Error(result.error || 'Не вдалося скачати');
    }

    console.log(`✅ Відео знайдено: ${result.platform}`);

    // Відправляємо відео
    await bot.telegram.sendVideo(chatId, result.videoUrl, {
      caption: `✅ Відео з ${result.platform}\n🤖 @SaveMedia_bot`,
      supports_streaming: true
    });

    console.log(`📤 Відправлено користувачу ${chatId}`);
    res.json({ success: true });

  } catch (error) {
    console.error('❌ Помилка:', error.message);

    try {
      await bot.telegram.sendMessage(
        chatId, 
        `❌ Помилка: ${error.message}\n\n` +
        `Підтримувані платформи:\n` +
        `✅ TikTok\n` +
        `✅ Instagram\n` +
        `✅ YouTube\n` +
        `✅ Twitter/X\n` +
        `✅ Facebook\n\n` +
        `Переконайся, що посилання правильне!`
      );
    } catch (e) {
      console.error('Не вдалося відправити повідомлення про помилку');
    }

    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/', (_, res) => res.send('🤖 SaveMedia Server Working!'));

// --- ЗАПУСК ---
process.on('uncaughtException', (error) => {
  console.error('❌ Критична помилка:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Відхилений проміс:', reason);
  process.exit(1);
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущений на порті ${PORT}`);
});

bot.launch()
  .then(() => console.log('✅ Бот запущений!'))
  .catch((error) => {
    console.error('❌ Помилка запуску бота:', error);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
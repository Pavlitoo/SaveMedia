// --- ІМПОРТИ БІБЛІОТЕК ---
const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

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
    '✅ TikTok (без водяних знаків)\n' +
    '✅ Instagram (Reels, Posts)\n' +
    '✅ YouTube (Videos & Shorts)\n' +
    '✅ Twitter/X\n' +
    '✅ Facebook\n\n' +
    '🎬 Просто натисни кнопку і вставь посилання!',
    Markup.keyboard([
      Markup.button.webApp('📥 Скачати Відео', 'https://save-media-fog3.vercel.app/')
    ]).resize()
  );
});

bot.help((ctx) => {
  ctx.reply(
    '📖 Інструкція:\n\n' +
    '1️⃣ Натисни "📥 Скачати Відео"\n' +
    '2️⃣ Вставь посилання\n' +
    '3️⃣ Чекай 5-30 сек\n\n' +
    '💡 Підказки:\n' +
    '• Для приватних акаунтів не працює\n' +
    '• YouTube: краще короткі відео\n' +
    '• Використовуй оригінальні посилання'
  );
});

// --- ФУНКЦІЇ ЗАВАНТАЖЕННЯ ---

function detectPlatform(url) {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('tiktok.com') || urlLower.includes('vt.tiktok')) return 'tiktok';
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
  if (urlLower.includes('instagram.com') || urlLower.includes('instagr.am')) return 'instagram';
  if (urlLower.includes('x.com') || urlLower.includes('twitter.com')) return 'twitter';
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch')) return 'facebook';
  return 'unknown';
}

// TikTok - ПРАЦЮЄ СТАБІЛЬНО ✅
async function downloadTikTok(url) {
  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
    const response = await fetch(apiUrl);
    const result = await response.json();

    if (result.code !== 0 || !result.data) {
      throw new Error('Не вдалося знайти відео');
    }

    const videoUrl = result.data.hdplay || result.data.play;
    if (!videoUrl) throw new Error('Немає посилання на відео');

    return { success: true, videoUrl, platform: 'TikTok' };
  } catch (error) {
    return { success: false, error: 'TikTok: ' + error.message };
  }
}

// Instagram - НОВИЙ МЕТОД через yt-dlp стиль ✅
async function downloadInstagram(url) {
  try {
    // Метод 1: SnapInsta API (найстабільніший)
    const response = await fetch('https://snapinsta.app/api/ajaxSearch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `q=${encodeURIComponent(url)}&t=media&lang=en`
    });

    const result = await response.json();
    
    if (result.status === 'ok' && result.data) {
      // Парсимо HTML для отримання прямого посилання
      const urlMatch = result.data.match(/href="([^"]*download[^"]*)"/i);
      if (urlMatch) {
        const downloadPage = urlMatch[1];
        // Отримуємо фінальне посилання
        const videoResponse = await fetch(downloadPage);
        const videoHtml = await videoResponse.text();
        const finalUrlMatch = videoHtml.match(/"contentUrl":"([^"]+)"/);
        
        if (finalUrlMatch) {
          const videoUrl = finalUrlMatch[1].replace(/\\u0026/g, '&');
          return { success: true, videoUrl, platform: 'Instagram' };
        }
      }
    }
  } catch (error) {
    console.log('Instagram метод 1 не спрацював');
  }

  // Метод 2: Простий Instagram API
  try {
    const postId = url.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/)?.[2];
    if (!postId) throw new Error('Невірне посилання');

    const apiUrl = `https://instagram-media-downloader.p.rapidapi.com/rapid/post.php?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl);
    const result = await response.json();

    if (result.video) {
      return { success: true, videoUrl: result.video, platform: 'Instagram' };
    }
  } catch (error) {
    console.log('Instagram метод 2 не спрацював');
  }

  return { success: false, error: 'Instagram: Не працює. Спробуй публічне відео.' };
}

// YouTube - YT-DLP стиль API ✅
async function downloadYouTube(url) {
  try {
    const videoId = url.match(/(?:v=|\/)([\w-]{11})/)?.[1];
    if (!videoId) throw new Error('Невірне посилання');

    // Використовуємо Cobalt для YouTube (вони мають хорошу підтримку)
    const response = await fetch('https://co.wuk.sh/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: url,
        vCodec: 'h264',
        vQuality: '720',
        aFormat: 'mp3',
        filenamePattern: 'basic',
        isAudioOnly: false
      })
    });

    const result = await response.json();
    
    if (result.status === 'redirect' && result.url) {
      return { success: true, videoUrl: result.url, platform: 'YouTube' };
    } else if (result.status === 'tunnel' && result.url) {
      return { success: true, videoUrl: result.url, platform: 'YouTube' };
    }
  } catch (error) {
    console.log('YouTube Cobalt не спрацював');
  }

  // Альтернатива: Loader.to API
  try {
    const videoId = url.match(/(?:v=|\/)([\w-]{11})/)?.[1];
    const apiUrl = `https://loader.to/ajax/download.php?format=360&url=https://www.youtube.com/watch?v=${videoId}`;
    
    const response = await fetch(apiUrl);
    const result = await response.json();

    if (result.success && result.download_url) {
      return { success: true, videoUrl: result.download_url, platform: 'YouTube' };
    }
  } catch (error) {
    console.log('YouTube loader.to не спрацював');
  }

  return { success: false, error: 'YouTube: Спробуй коротше відео або Shorts' };
}

// Twitter/X - VX метод ✅
async function downloadTwitter(url) {
  try {
    // Використовуємо VXTwitter API
    const tweetId = url.match(/status\/(\d+)/)?.[1];
    if (!tweetId) throw new Error('Невірне посилання');

    const vxUrl = url.replace('twitter.com', 'api.vxtwitter.com').replace('x.com', 'api.vxtwitter.com');
    
    const response = await fetch(vxUrl);
    const result = await response.json();

    if (result.media_extended && result.media_extended.length > 0) {
      const video = result.media_extended.find(m => m.type === 'video');
      if (video && video.url) {
        return { success: true, videoUrl: video.url, platform: 'Twitter/X' };
      }
    }
  } catch (error) {
    console.log('Twitter VX API не спрацював');
  }

  return { success: false, error: 'Twitter: Не знайдено відео у твіті' };
}

// Facebook - простий метод ✅
async function downloadFacebook(url) {
  try {
    const response = await fetch('https://fdownloader.net/api/ajaxSearch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `q=${encodeURIComponent(url)}&lang=en`
    });

    const result = await response.json();

    if (result.status === 'ok' && result.data) {
      const videoMatch = result.data.match(/href="([^"]+\.mp4[^"]*)"/);
      if (videoMatch) {
        return { success: true, videoUrl: videoMatch[1], platform: 'Facebook' };
      }
    }
  } catch (error) {
    console.log('Facebook не спрацював');
  }

  return { success: false, error: 'Facebook: Тільки публічні відео' };
}

// Основна функція
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
      return { success: false, error: 'Непідтримувана платформа' };
  }
}

// --- API ENDPOINT ---
app.post('/download', async (req, res) => {
  const { url, chatId } = req.body;

  console.log(`📥 Запит: ${url}`);

  if (!url || !chatId) {
    return res.status(400).json({ success: false, message: 'Немає URL або chatId' });
  }

  try {
    await bot.telegram.sendMessage(chatId, '🔄 Обробляю відео...');

    const result = await downloadVideo(url);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log(`✅ Відео знайдено: ${result.platform}`);

    // Відправляємо відео
    await bot.telegram.sendVideo(chatId, result.videoUrl, {
      caption: `✅ ${result.platform}\n🤖 @SaveMedia_bot`,
      supports_streaming: true
    });

    console.log(`📤 Відправлено!`);
    res.json({ success: true });

  } catch (error) {
    console.error('❌ Помилка:', error.message);

    try {
      await bot.telegram.sendMessage(
        chatId,
        `❌ ${error.message}\n\n` +
        `💡 Переконайся що:\n` +
        `• Посилання правильне\n` +
        `• Акаунт публічний\n` +
        `• Відео не видалено`
      );
    } catch (e) {
      console.error('Не вдалося відправити помилку');
    }

    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/', (_, res) => res.send('🤖 SaveMedia Working!'));

// --- ЗАПУСК ---
process.on('uncaughtException', (error) => {
  console.error('❌ Критична помилка:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Відхилений проміс:', reason);
});

app.listen(PORT, () => {
  console.log(`✅ Сервер: ${PORT}`);
});

bot.launch()
  .then(() => console.log('✅ Бот запущений!'))
  .catch((error) => {
    console.error('❌ Помилка бота:', error);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
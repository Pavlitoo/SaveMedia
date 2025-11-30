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

// Instagram - ПРОСТІШИЙ API ✅
async function downloadInstagram(url) {
  try {
    // Метод 1: Instagram Downloader через RapidAPI proxy
    const apiUrl = `https://instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com/get-info-rapidapi?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': 'free-trial', // Публічний безкоштовний ендпоінт
      }
    });

    const result = await response.json();

    if (result.download_url) {
      return { success: true, videoUrl: result.download_url, platform: 'Instagram' };
    }
  } catch (error) {
    console.log('Instagram метод 1 не спрацював, пробую метод 2...');
  }

  // Метод 2: Використовуємо Inflact
  try {
    const shortcode = url.match(/\/p\/([^/?]+)/)?.[1] || url.match(/\/reel\/([^/?]+)/)?.[1];
    if (!shortcode) throw new Error('Невірне посилання');

    const apiUrl = `https://inflact.com/tools/downloader/instagram/video/${shortcode}`;
    const response = await fetch(apiUrl);
    const html = await response.text();
    
    const videoMatch = html.match(/"contentUrl":"([^"]+)"/);
    if (videoMatch) {
      const videoUrl = videoMatch[1].replace(/\\u0026/g, '&');
      return { success: true, videoUrl, platform: 'Instagram' };
    }
  } catch (error) {
    console.log('Instagram метод 2 не спрацював');
  }
    
  return { success: false, error: 'Instagram: Не вдалося завантажити відео. Можливо, акаунт приватний.' };
}

// YouTube - ПРОСТІШИЙ API ✅
async function downloadYouTube(url) {
  try {
    // Витягуємо ID відео
    const videoId = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([^&\n?#]+)/)?.[1];
    if (!videoId) throw new Error('Невірне посилання на YouTube');

    // Метод 1: Простий YouTube Downloader API
    const apiUrl = `https://yt-api.p.rapidapi.com/dl?id=${videoId}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': 'free-trial'
      }
    });

    const result = await response.json();

    if (result.formats && result.formats.length > 0) {
      // Шукаємо найкращу якість з відео і аудіо
      const videoFormat = result.formats.find(f => f.qualityLabel && f.hasAudio) || result.formats[0];
      if (videoFormat.url) {
        return { success: true, videoUrl: videoFormat.url, platform: 'YouTube' };
      }
    }
  } catch (error) {
    console.log('YouTube метод 1 не спрацював, пробую метод 2...');
  }

  // Метод 2: Альтернативний простий API
  try {
    const videoId = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([^&\n?#]+)/)?.[1];
    const apiUrl = `https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`;
    
    const response = await fetch(apiUrl);
    const result = await response.json();

    if (result.link) {
      return { success: true, videoUrl: result.link, platform: 'YouTube' };
    }
  } catch (error) {
    console.log('YouTube метод 2 не спрацював');
  }

  return { success: false, error: 'YouTube: Не вдалося завантажити. Спробуйте пізніше або коротше відео.' };
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

// Facebook - ПРОСТІШИЙ API ✅
async function downloadFacebook(url) {
  try {
    // Метод 1: FBDownloader
    const apiUrl = `https://facebook-reel-and-video-downloader.p.rapidapi.com/app/main.php?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': 'free-trial'
      }
    });

    const result = await response.json();

    if (result.links && result.links.length > 0) {
      // Беремо найкращу якість
      const videoUrl = result.links[0].link;
      return { success: true, videoUrl, platform: 'Facebook' };
    }
  } catch (error) {
    console.log('Facebook метод 1 не спрацював, пробую метод 2...');
  }

  // Метод 2: GetFVid
  try {
    const apiUrl = 'https://getfvid.com/downloader';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `url=${encodeURIComponent(url)}`
    });

    const html = await response.text();
    const videoMatch = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/);
    
    if (videoMatch) {
      return { success: true, videoUrl: videoMatch[1], platform: 'Facebook' };
    }
  } catch (error) {
    console.log('Facebook метод 2 не спрацював');
  }

  return { success: false, error: 'Facebook: Не вдалося завантажити. Можливо, відео приватне.' };
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
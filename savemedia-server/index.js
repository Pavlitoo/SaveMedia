// --- ІМПОРТИ ---
const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const execPromise = promisify(exec);

// --- ПЕРЕВІРКА ТОКЕНА ---
if (!process.env.BOT_TOKEN) {
  console.error('❌ ПОМИЛКА: Відсутній BOT_TOKEN!');
  process.exit(1);
}

// --- ІНІЦІАЛІЗАЦІЯ ---
const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- ЛОГІКА БОТА ---
bot.start((ctx) => {
  ctx.reply(
    '🎉 SaveMedia - Універсальний завантажувач!\n\n' +
    '✅ **ПРАЦЮЄ ЧУДОВО:**\n' +
    '• TikTok (без водяних знаків)\n' +
    '• Instagram (Reels, Posts, Stories)\n' +
    '• Twitter/X, Facebook\n' +
    '• Reddit, Pinterest, Vimeo\n' +
    '• та 1000+ інших!\n\n' +
    '⚠️ **YOUTUBE (обмежено):**\n' +
    '• ✅ Короткі відео (2-10 хв)\n' +
    '• ❌ Shorts не працює\n' +
    '• ❌ Відео 18+ не працює\n' +
    '💡 Для Shorts краще використовуй TikTok/Instagram!',
    Markup.inlineKeyboard([
      Markup.button.webApp('Скачати Відео 🚀', 'https://save-media-fog3.vercel.app/')
    ])
  );
});

bot.help((ctx) => {
  ctx.reply(
    '📖 **Інструкція:**\n\n' +
    '1️⃣ Натисни "📥 Скачати Відео"\n' +
    '2️⃣ Вставь посилання\n' +
    '3️⃣ Чекай 5-30 сек\n\n' +
    '✅ **Що працює на 100%:**\n' +
    '• TikTok\n' +
    '• Instagram Reels/Posts\n' +
    '• Twitter/X\n' +
    '• Facebook (публічні)\n' +
    '• Reddit, Vimeo, Pinterest\n\n' +
    '⚠️ **YouTube обмеження:**\n' +
    '• Працює тільки зі звичайними відео\n' +
    '• Shorts НЕ підтримуються\n' +
    '• Відео 18+ НЕ працюють\n' +
    '• Краще відео до 10 хв\n\n' +
    '💡 Замість YouTube Shorts використовуй TikTok або Instagram Reels - там працює ідеально!'
  );
});

// --- ФУНКЦІЯ ЗАВАНТАЖЕННЯ ЧЕРЕЗ YT-DLP ---
async function downloadWithYtDlp(url) {
  const tempDir = '/tmp';

  try {
    console.log('🔍 Починаю завантаження через yt-dlp...');

    const ytdlpPath = path.join(__dirname, 'yt-dlp');
    
    // Додаємо більше опцій для обходу захисту YouTube
    const command = `${ytdlpPath} --no-warnings --no-playlist --format "best[height<=720][ext=mp4]/best[ext=mp4]/best" --get-url "${url}" --no-check-certificates --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"`;

    const { stdout, stderr } = await execPromise(command, {
      timeout: 45000, // 45 секунд для YouTube
      maxBuffer: 1024 * 1024 * 10
    });

    if (stderr && !stdout) {
      throw new Error('Не вдалося обробити відео');
    }

    const videoUrl = stdout.trim().split('\n')[0];

    if (!videoUrl || !videoUrl.startsWith('http')) {
      throw new Error('Не вдалося отримати пряме посилання');
    }

    console.log('✅ Пряме посилання отримано!');
    return { success: true, videoUrl };

  } catch (error) {
    console.error('❌ Помилка yt-dlp:', error.message);
    
    // Якщо це YouTube і є проблема з аутентифікацією - використовуємо альтернативу
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      console.log('🔄 YouTube захист виявлено, використовую альтернативний метод...');
      return { success: false, error: 'youtube_auth_needed' };
    }
    
    return { success: false, error: error.message };
  }
}

// --- АЛЬТЕРНАТИВНИЙ МЕТОД ДЛЯ YOUTUBE ---
async function downloadYouTube(url) {
  // Перевіряємо чи це Shorts
  if (url.includes('/shorts/')) {
    return { 
      success: false, 
      error: '❌ YouTube Shorts не підтримуються через обмеження API.\n\n💡 Спробуй:\n• Звичайне YouTube відео (не Shorts)\n• TikTok, Instagram Reels замість Shorts' 
    };
  }

  // Метод 1: Простий і швидкий SaveTube
  try {
    console.log('🔄 YouTube метод 1: SaveTube...');
    const videoId = url.match(/(?:v=|\/)([\w-]{11})/)?.[1];
    if (!videoId) throw new Error('Невірний ID');

    const apiUrl = `https://savetube.me/api/v1/telemix/${videoId}`;
    
    const response = await fetch(apiUrl);
    const result = await response.json();

    if (result.status && result.formats) {
      // Шукаємо найкращий формат (360p або 480p)
      const format = result.formats.find(f => 
        f.quality === '360p' || f.quality === '480p' || f.quality === '240p'
      ) || result.formats[0];

      if (format?.url) {
        return { success: true, videoUrl: format.url };
      }
    }
  } catch (error) {
    console.log('YouTube SaveTube помилка:', error.message);
  }

  // Метод 2: Y2Mate (backup)
  try {
    console.log('🔄 YouTube метод 2: Y2Mate...');
    const videoId = url.match(/(?:v=|\/)([\w-]{11})/)?.[1];

    const response = await fetch('https://www.y2mate.com/mates/analyzeV2/ajax', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `k_query=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&k_page=home&hl=en&q_auto=0`
    });

    const result = await response.json();
    
    if (result.status === 'ok' && result.links?.mp4) {
      const formats = result.links.mp4;
      const quality = Object.keys(formats).find(q => q.includes('360')) || Object.keys(formats)[0];
      
      if (formats[quality]?.k) {
        const convertResponse = await fetch('https://www.y2mate.com/mates/convertV2/index', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `vid=${videoId}&k=${formats[quality].k}`
        });

        const convertResult = await convertResponse.json();
        
        if (convertResult.dlink) {
          return { success: true, videoUrl: convertResult.dlink };
        }
      }
    }
  } catch (error) {
    console.log('YouTube Y2Mate помилка:', error.message);
  }

  return { 
    success: false, 
    error: '❌ Не вдалося завантажити YouTube відео.\n\n' +
           '🚫 Можливі причини:\n' +
           '• Вікове обмеження (18+)\n' +
           '• Занадто довге відео (>10 хв)\n' +
           '• Приватне або видалене\n' +
           '• YouTube Shorts (не підтримується)\n\n' +
           '✅ Працює краще з:\n' +
           '• Короткими відео (2-5 хв)\n' +
           '• Публічними відео без обмежень'
  };
}

// --- РЕЗЕРВНИЙ МЕТОД: TIKWM ДЛЯ TIKTOK ---
async function downloadTikTok(url) {
  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
    const response = await fetch(apiUrl);
    const result = await response.json();

    if (result.code === 0 && result.data) {
      const videoUrl = result.data.hdplay || result.data.play;
      return { success: true, videoUrl };
    }
  } catch (error) {
    console.log('TikWM резерв не спрацював');
  }
  return { success: false };
}

// --- ГОЛОВНА ФУНКЦІЯ ---
async function downloadVideo(url) {
  // Якщо це YouTube - одразу використовуємо спеціальні API (не yt-dlp)
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    console.log('🎥 Виявлено YouTube, використовую спеціальні методи...');
    return await downloadYouTube(url);
  }

  // Якщо це TikTok - використовуємо TikWM
  if (url.includes('tiktok')) {
    console.log('🎵 Виявлено TikTok...');
    return await downloadTikTok(url);
  }

  // Для всіх інших - спочатку пробуємо yt-dlp
  let result = await downloadWithYtDlp(url);

  // Якщо не спрацювало - повертаємо помилку
  if (!result.success) {
    return { success: false, error: 'Не вдалося завантажити з цієї платформи' };
  }

  return result;
}

// --- API ENDPOINT ---
app.post('/download', async (req, res) => {
  const { url, chatId } = req.body;

  if (!url || !chatId) {
    return res.status(400).json({ success: false, message: 'Немає URL' });
  }

  console.log(`📥 Запит: ${url}`);

  try {
    await bot.telegram.sendMessage(chatId, '⏳ Обробляю відео...');

    const result = await downloadVideo(url);

    if (!result.success) {
      throw new Error(result.error || 'Не вдалося завантажити відео');
    }

    console.log('📤 Відправляю відео...');

    // Відправляємо відео в Telegram
    await bot.telegram.sendVideo(chatId, result.videoUrl, {
      caption: '✅ Відео завантажено!\n🤖 @SaveMedia_bot',
      supports_streaming: true
    });

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Помилка:', error.message);

    try {
      await bot.telegram.sendMessage(
        chatId,
        error.message || 
        '❌ Не вдалося завантажити.\n\n' +
        '💡 **Поради:**\n' +
        '• Перевір посилання\n' +
        '• Акаунт має бути публічним\n' +
        '• Відео не видалене\n\n' +
        '⚠️ **YouTube:**\n' +
        '• Shorts НЕ працює (використовуй TikTok)\n' +
        '• Відео 18+ НЕ працює\n' +
        '• Краще короткі відео (до 10 хв)'
      );
    } catch (e) {}

    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/', (_, res) => res.send('🤖 SaveMedia Server (yt-dlp powered)'));

// --- ЗАПУСК ---
app.listen(PORT, () => console.log(`✅ Сервер: ${PORT}`));

bot.launch()
  .then(() => console.log('✅ Бот запущений!'))
  .catch(err => {
    console.error('❌ Помилка:', err);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
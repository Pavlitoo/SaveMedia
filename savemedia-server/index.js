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
    '🎉 SaveMedia - Універсальний завантажувач відео!\n\n' +
    '📱 **Основні платформи:**\n' +
    '✅ TikTok (без водяних знаків)\n' +
    '✅ Instagram (Reels, Posts, Stories)\n' +
    '✅ YouTube (Videos & Shorts)\n' +
    '✅ Twitter/X\n' +
    '✅ Facebook (публічні відео)\n\n' +
    '🌐 **Також підтримується:**\n' +
    '• Reddit, Pinterest, Vimeo\n' +
    '• Twitch, Dailymotion\n' +
    '• VK, OK.ru, Rutube\n' +
    '• Streamable, Imgur\n' +
    '• Bandcamp, SoundCloud\n' +
    '• та 1000+ інших!\n\n' +
    '🚀 Просто відправ посилання!',
    Markup.keyboard([
      Markup.button.webApp('📥 Скачати Відео', 'https://save-media-fog3.vercel.app/')
    ]).resize()
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
  try {
    const videoId = url.match(/(?:v=|\/)([\w-]{11})/)?.[1];
    if (!videoId) throw new Error('Невірне посилання');

    // Використовуємо простий YouTube API без аутентифікації
    const apiUrl = `https://yt1s.io/api/ajaxSearch`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `q=${encodeURIComponent(url)}&vt=mp4`
    });

    const result = await response.json();

    if (result.status === 'ok' && result.links?.mp4) {
      const qualities = Object.keys(result.links.mp4);
      const quality = qualities.find(q => q.includes('360') || q.includes('480')) || qualities[0];
      
      if (result.links.mp4[quality]) {
        const convertUrl = result.links.mp4[quality].k;
        
        // Отримуємо фінальне посилання
        const convertResponse = await fetch('https://yt1s.io/api/ajaxConvert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `vid=${videoId}&k=${convertUrl}`
        });

        const convertResult = await convertResponse.json();
        
        if (convertResult.status === 'ok' && convertResult.dlink) {
          return { success: true, videoUrl: convertResult.dlink };
        }
      }
    }
  } catch (error) {
    console.log('YouTube альтернатива 1 не спрацювала');
  }

  // Альтернатива 2: Loader.to
  try {
    const videoId = url.match(/(?:v=|\/)([\w-]{11})/)?.[1];
    const apiUrl = `https://loader.to/ajax/download.php?format=360&url=https://www.youtube.com/watch?v=${videoId}`;
    
    const response = await fetch(apiUrl);
    const result = await response.json();

    if (result.success && result.download_url) {
      return { success: true, videoUrl: result.download_url };
    }
  } catch (error) {
    console.log('YouTube альтернатива 2 не спрацювала');
  }

  return { success: false };
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
  // Спочатку пробуємо yt-dlp (універсальний)
  let result = await downloadWithYtDlp(url);

  // Якщо YouTube потребує аутентифікації - використовуємо альтернативу
  if (!result.success && result.error === 'youtube_auth_needed') {
    console.log('🔄 Використовую спеціальний YouTube API...');
    result = await downloadYouTube(url);
  }

  // Якщо не спрацювало і це TikTok - пробуємо резерв
  if (!result.success && url.includes('tiktok')) {
    console.log('🔄 Пробую резервний TikTok API...');
    result = await downloadTikTok(url);
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
        `❌ Помилка: ${error.message}\n\n` +
        '💡 Поради:\n' +
        '• Перевір посилання\n' +
        '• Акаунт має бути публічним\n' +
        '• Відео не має бути видаленим'
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
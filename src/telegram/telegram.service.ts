import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name)

  async sendMessage(message: string): Promise<void> {
    const TELEGRAM_BOT_TOKEN = process.env.YOUR_BOT_TOKEN
    const CHAT_ID = process.env.CHAT_ID
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`

    try {
      await axios.post(url, {
        chat_id: CHAT_ID,
        text: message
      })
      this.logger.log('Сообщение отправлено в Telegram')
    } catch (error) {
      this.logger.error(
        'Ошибка при отправке сообщения в Telegram: ' + error.message
      )
      throw new Error(error.message)
    }
  }
}

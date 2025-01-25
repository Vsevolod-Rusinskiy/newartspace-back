// src/one-click-order/one-click-order.service.ts
import { HttpStatus, HttpException, Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { RequestFormDto } from './dto/request-form.dto'

@Injectable()
export class RequestFormService {
  private readonly logger = new Logger(RequestFormService.name)

  private async sendTelegramMessage(message: string) {
    const TELEGRAM_BOT_TOKEN = process.env.YOUR_BOT_TOKEN
    const CHAT_ID = process.env.CHAT_ID
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`

    console.log('Токен бота:', TELEGRAM_BOT_TOKEN)
    console.log('Chat ID:', CHAT_ID)

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

  async sendOrder(orderData: RequestFormDto) {
    this.logger.log('Отправка заказа: ' + JSON.stringify(orderData))

    const message = `Имя: ${orderData.name}, Телефон: ${orderData.phone}, Email: ${orderData.email}`

    try {
      const result = await this.sendTelegramMessage(`Новый заказ: ${message}`)
      return result
    } catch (error) {
      throw new HttpException(
        'Ошибка при создании заказа',
        HttpStatus.BAD_REQUEST
      )
    }
  }
}

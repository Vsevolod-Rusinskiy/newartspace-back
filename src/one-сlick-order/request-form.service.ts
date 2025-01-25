// src/one-click-order/one-click-order.service.ts
import { HttpStatus, HttpException, Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { RequestFormDto } from './dto/request-form.dto'
import { InjectModel } from '@nestjs/sequelize'
import { Painting } from '../paintings/models/painting.model'
import { Artist } from '../artists/models/artist.model'

@Injectable()
export class RequestFormService {
  private readonly logger = new Logger(RequestFormService.name)

  constructor(
    @InjectModel(Painting)
    private paintingModel: typeof Painting
  ) {}

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

  async sendOrderReproduction(orderData: RequestFormDto) {
    this.logger.log('Отправка заказа: ' + JSON.stringify(orderData))

    let paintingInfo = 'Картина не выбрана'

    if (orderData.paintingId) {
      const painting = await this.paintingModel.findOne({
        where: { id: orderData.paintingId },
        include: [{ model: Artist }]
      })

      if (painting) {
        paintingInfo = `Картина "${painting.title}" художника ${painting.artist.artistName}`
      }
    }

    const message = `Имя: ${orderData.name}
Телефон: ${orderData.phone}
Email: ${orderData.email}
${paintingInfo}
Тип формы: репродукция`

    try {
      const result = await this.sendTelegramMessage(`Новый заказ: 
${message}`)
      return result
    } catch (error) {
      throw new HttpException(
        'Ошибка при создании заказа',
        HttpStatus.BAD_REQUEST
      )
    }
  }

  async sendOrderCart(orderData: RequestFormDto) {
    this.logger.log('Отправка заказа корзины: ' + JSON.stringify(orderData))

    let cartItemsInfo = 'Картины не выбраны'

    if (orderData.cartItemIds && orderData.cartItemIds.length > 0) {
      const paintings = await this.paintingModel.findAll({
        where: { id: orderData.cartItemIds },
        include: [{ model: Artist }]
      })

      if (paintings.length > 0) {
        const paintingsList = paintings
          .map(
            (painting) =>
              `- "${painting.title}" художника ${painting.artist.artistName}`
          )
          .join('\n')

        cartItemsInfo = `Выбранные картины:\n${paintingsList}`
      }
    }

    const message = `Имя: ${orderData.name}
Телефон: ${orderData.phone}
Email: ${orderData.email}
${cartItemsInfo}
Тип формы: заказ из корзины`

    try {
      const result = await this.sendTelegramMessage(`Новый заказ: 
${message}`)
      return result
    } catch (error) {
      throw new HttpException(
        'Ошибка при создании заказа',
        HttpStatus.BAD_REQUEST
      )
    }
  }
}

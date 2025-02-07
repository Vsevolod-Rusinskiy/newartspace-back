// src/one-click-order/one-click-order.service.ts
import { HttpStatus, HttpException, Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { RequestFormDto } from './dto/request-form.dto'
import { InjectModel } from '@nestjs/sequelize'
import { Painting } from '../paintings/models/painting.model'
import { Artist } from '../artists/models/artist.model'
import { MailService } from '../mail/mail.service'
import { OrdersService } from '../orders/orders.service'
import { CreateOrderDto } from '../orders/dto/create-order.dto'
import { UsersService } from '../users/users.service'

@Injectable()
export class RequestFormService {
  private readonly logger = new Logger(RequestFormService.name)

  constructor(
    @InjectModel(Painting)
    private paintingModel: typeof Painting,
    private mailService: MailService,
    private ordersService: OrdersService,
    private usersService: UsersService
  ) {}

  private async findUserByEmail(email: string): Promise<number | null> {
    try {
      const user = await this.usersService.findOne(email)
      return user ? user.id : null
    } catch (error) {
      this.logger.warn(`User not found for email: ${email}`)
      return null
    }
  }

  private async sendTelegramMessage(message: string) {
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

  private async sendEmails(
    clientEmail: string,
    adminMessage: string,
    paintingInfo: string
  ) {
    try {
      const clientMessage = `Здравствуйте!

Мы получили ваш заказ на ${paintingInfo}

В ближайшее время наш менеджер рассмотрит вашу заявку и свяжется с вами для уточнения деталей.

Спасибо за ваш заказ!

С уважением,
Галерея молодых и малоизвестных художников
Новое пространство

Контакты:
+7 (921) 932-62-15
Пн - Пт с 13:00 до 19:00
Сб - по предварительной договоренности

Адрес:
Санкт-Петербург, ул. Ново-Рыбинская,
д. 19-21, БЦ «Квартал», центральный
вход, 2 этаж, пом. 9`

      await this.mailService.sendMail(
        'Ваш заказ получен',
        clientEmail,
        clientMessage
      )
      await this.mailService.sendMail(
        'Новый заказ',
        process.env.NODEMAILER_EMAIL,
        adminMessage
      )
      this.logger.log('Письма успешно отправлены')
    } catch (error) {
      this.logger.error('Ошибка при отправке писем:', error.message)
      throw new Error('Ошибка при отправке писем')
    }
  }

  async sendOrderReproduction(orderData: RequestFormDto) {
    this.logger.log('Отправка заказа: ' + JSON.stringify(orderData))

    let paintingInfo = 'Картина не выбрана'
    let painting = null

    if (orderData.paintingId) {
      painting = await this.paintingModel.findOne({
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
      await this.sendTelegramMessage(`Новый заказ: \n${message}`)
      await this.sendEmails(orderData.email, message, paintingInfo)

      // Ищем пользователя по email
      const userId = await this.findUserByEmail(orderData.email)

      // Создаем заказ
      if (painting) {
        const createOrderDto: CreateOrderDto = {
          customerName: orderData.name,
          customerEmail: orderData.email,
          customerPhone: orderData.phone,
          description: 'Заказ репродукции',
          totalPrice: painting.price,
          userId: userId,
          orderItems: [
            {
              paintingId: painting.id,
              quantity: 1,
              price: painting.price
            }
          ]
        }
        await this.ordersService.create(createOrderDto)
      }

      return { success: true }
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
    let paintingsListForClient = ''
    let paintings = []

    if (orderData.cartItemIds && orderData.cartItemIds.length > 0) {
      paintings = await this.paintingModel.findAll({
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
        paintingsListForClient = paintings
          .map(
            (painting) =>
              `"${painting.title}" художника ${painting.artist.artistName}`
          )
          .join(', ')
      }
    }

    const message = `Имя: ${orderData.name}
Телефон: ${orderData.phone}
Email: ${orderData.email}
${cartItemsInfo}
Тип формы: заказ из корзины`

    try {
      await this.sendTelegramMessage(`Новый заказ: \n${message}`)
      await this.sendEmails(orderData.email, message, paintingsListForClient)

      // Ищем пользователя по email
      const userId = await this.findUserByEmail(orderData.email)

      // Создаем заказ
      if (paintings.length > 0) {
        const totalPrice = paintings.reduce(
          (sum, painting) => sum + painting.price,
          0
        )
        const createOrderDto: CreateOrderDto = {
          customerName: orderData.name,
          customerEmail: orderData.email,
          customerPhone: orderData.phone,
          description: 'Заказ из корзины',
          totalPrice: totalPrice,
          userId: userId,
          orderItems: paintings.map((painting) => ({
            paintingId: painting.id,
            quantity: 1,
            price: painting.price
          }))
        }
        await this.ordersService.create(createOrderDto)
      }

      return { success: true }
    } catch (error) {
      throw new HttpException(
        'Ошибка при создании заказа',
        HttpStatus.BAD_REQUEST
      )
    }
  }
}

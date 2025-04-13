import { Injectable, Logger } from '@nestjs/common'
import { Painting } from '../paintings/models/painting.model'

@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name)

  /**
   * Создает полный HTML-шаблон для email
   */
  createEmailTemplate(
    clientName: string,
    paintings: Painting[],
    totalSum: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    deliveryMethod: string
  ): string {
    // Создаем HTML для каждого товара
    const itemsHTML = paintings
      .map((painting) => this.createCartItemHTML(painting))
      .join('')

    // Собираем полный шаблон
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Ваш заказ получен</title>
      <style>
        body { 
          font-family: 'Arial', 'Helvetica', sans-serif; 
          line-height: 1.6; 
          color: #878787; 
          background-color: #f9f9f9; 
          margin: 0; 
          padding: 0; 
        }
        .container { 
          max-width: 660px; 
          margin: 0 auto; 
          background-color: #fff5f6; 
        }
        .header { text-align: center; padding: 20px 0; border-bottom: 1px solid #eaeaea; }
        .content { background-color: #fff; padding: 20px; margin: 20px 0; }
        .message-block {
          background-color: #fff5f6;
          padding: 20px;
          margin: 20px 0;
          font-family: Arial, Helvetica, sans-serif;
          color: #555;
          font-size: 17px;
        }
        h1, h2, h3, h4, .oswald-font { font-family: 'Arial', 'Helvetica', sans-serif; }
        .btn-back {
          display: block;
          text-align: center;
          margin: 20px auto;
          color: #ffffff;
          background-color: #730f0d;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 16px;
          font-weight: 500;
          text-decoration: none;
          padding: 7px 25px;
          width: fit-content;
        }
        .btn-back:hover {
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <div class="container">
        ${this.createHeader()}
        
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}" class="btn-back" style="display: block; text-align: center; margin: 20px auto; color: #ffffff; background-color: #730f0d; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 500; text-decoration: none; padding: 7px 25px; width: fit-content;">
          Обратно на сайт
        </a>
        
        <div class="message-block" style="background-color: #fff5f6; padding: 20px; margin: 20px 0; font-family: Arial, Helvetica, sans-serif; color: #555; font-size: 17px;">
          <h2 style="font-family: Arial, Helvetica, sans-serif; font-weight: 600; color: #555; margin-top: 0;">Здравствуйте, ${clientName}!</h2>
          <p style="margin-bottom: 0; font-size: 17px;">Благодарим за заказ, оформленный в нашей Галерее.</p>
        </div>
        
        <div class="content" style="background-color: #fff; padding: 20px; margin: 20px 0;">
          <div class="items-container">
            ${itemsHTML}
          </div>
          
          ${this.createTotalSection(totalSum)}
        </div>
        
        <div class="message-block" style="background-color: #fff5f6; padding: 20px; margin: 20px 0; font-family: Arial, Helvetica, sans-serif; color: #555; font-size: 17px;">
          <p style="margin-top: 0; font-size: 17px;">Сейчас мы проверяем наличие произведений искусства. Для продолжения покупки, пожалуйста, дождитесь следующего письма.</p>
          <p style="margin-bottom: 0; font-size: 17px;">С наилучшими пожеланиями, Кабанченко Светлана.</p>
        </div>
        
        ${this.createFooter()}
      </div>
    </body>
    </html>
    `
  }

  /**
   * Создает HTML для хедера письма с изображением
   */
  private createHeader(): string {
    // Используем ту же картинку, что и в футере
    const imageUrl = 'http://193.108.113.149/email-footer.png'

    return `
    <div style="margin-bottom: 30px; padding: 30px 20px; background-image: url('${imageUrl}'); background-size: cover; background-position: center; color: #ffffff; font-family: Arial, Helvetica, sans-serif; text-align: center;">
      <p style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 300; margin: 0 0 5px; padding: 0; letter-spacing: 1px; text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);">
        Галерея молодых и малоизвестных художников
      </p>
      <h1 style="font-family: Arial, Helvetica, sans-serif; font-size: 40px; font-weight: 400; margin: 0; padding: 0; letter-spacing: 2px; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);">
        Новое пространство
      </h1>
    </div>
    `
  }

  /**
   * Создает HTML для футера письма (заготовка)
   */
  private createFooter(): string {
    const footerImageUrl = 'http://193.108.113.149/email-footer.png'

    return `
    <div style="margin-top: 30px; padding: 30px 20px; background-image: url('${footerImageUrl}'); background-size: cover; background-position: center; color: #ffffff; font-family: Arial, Helvetica, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; text-align: center;">
        <p style="font-size: 16px; margin-bottom: 5px; font-weight: 500;">Кабанченко Светлана Геннадьевна</p>
        <p style="font-size: 14px; margin-bottom: 20px;">ИНН 781432217443</p>
        
        <p style="font-size: 14px; margin: 5px 0;">
          Санкт-Петербург, ул. Ново-Рыбинская,<br>
          д. 19-21, БЦ «Квартал», центральный<br>
          вход, 2 этаж, пом. 9
        </p>
        
        <p style="font-size: 14px; margin: 15px 0;">
          Тел: <a href="tel:+79219326215" style="color: #ffffff; text-decoration: none;">+7 (921) 932-62-15</a>
        </p>
        
        <p style="font-size: 14px; margin: 15px 0;">
          E-mail: <a href="mailto:9326215@mail.ru" style="color: #ffffff; text-decoration: none;">9326215@mail.ru</a>
        </p>
        
        <p style="font-size: 12px; margin-top: 20px; opacity: 0.8;">
          © 2021 – 2025 Галерея молодых и малоизвестных художников «Новое пространство».
        </p>
        
        <p style="font-size: 12px; margin-top: 5px; opacity: 0.8;">
          Все права защищены и запатентованы
        </p>
      </div>
    </div>
    `
  }

  /**
   * Создает HTML для секции с итоговой суммой
   */
  private createTotalSection(totalSum: number): string {
    return `
    <div style="margin-top: 30px; padding: 15px 25px; border-top: 1px solid #eaeaea; text-align: right;">
      <div style="display: inline-block;">
        <span style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; color: #878787; font-weight: 500; margin-right: 15px; display: inline-block;">Итого:</span>
        <span style="font-family: Arial, Helvetica, sans-serif; font-size: 24px; font-weight: 700; color: #ff3a44; display: inline-block;">${totalSum} ₽</span>
      </div>
    </div>
    `
  }

  /**
   * Создает HTML для элемента корзины
   */
  createCartItemHTML(painting: Painting): string {
    // Расчет цены со скидкой
    const calculatePriceWithDiscount = (price: number, discount: number) => {
      return Math.round(price - (price * discount) / 100)
    }

    // Функция для расчета итоговой цены товара с учетом типа цены и скидки
    const calculateItemPrice = (painting) => {
      switch (painting.priceType) {
        case 'Специальное предложение':
          return painting.price
        case 'Скидка':
          return calculatePriceWithDiscount(painting.price, painting.discount)
        default:
          return painting.discount
            ? calculatePriceWithDiscount(painting.price, painting.discount)
            : painting.price
      }
    }

    // Вычисление итоговой цены для товара
    const finalPrice = calculateItemPrice(painting)
    let discountText = ''
    let originalPriceHTML = ''

    if (painting.priceType === 'Скидка' && painting.discount) {
      discountText = `СКИДКА ${painting.discount}%`
      originalPriceHTML = `${painting.price} ₽`
    } else if (painting.priceType === 'Специальное предложение') {
      // Для специального предложения выводим полный текст
      discountText = `СПЕЦИАЛЬНОЕ ПРЕДЛОЖЕНИЕ${painting.discount ? ` ${painting.discount}% ОТ ЦЕНЫ НА КАРТУ` : ''}`
    } else if (painting.discount) {
      discountText = `СКИДКА ${painting.discount}%`
      originalPriceHTML = `${painting.price} ₽`
    }

    // Информация о размерах
    const dimensions =
      painting.height && painting.width
        ? `${painting.height} x ${painting.width}`
        : 'Не указан'

    // Информация о материалах
    const materials =
      [painting.material, painting.technique].filter(Boolean).join(', ') ||
      'Не указаны'

    return `
    <div style="display: flex; margin-bottom: 20px; padding: 15px; border: 1px solid #eaeaea; background-color: #fff; font-family: Arial, Helvetica, sans-serif; min-width: 560px;">
      <div style="width: 150px; height: 150px; position: relative; margin-right: 15px; flex-shrink: 0;">
        <img src="${painting.imgUrl}" alt="${painting.title}" style="width: 100%; height: 100%; object-fit: cover;" />
      </div>
      
      <div style="flex: 1; display: flex; flex-direction: column;">
        <div style="font-size: 14px; color: #878787; margin-bottom: 10px; font-family: Arial, Helvetica, sans-serif;">
          <p style="margin: 5px 0;"><span style="color: #6a6a6a; font-weight: 500;">Название:</span> ${painting.title}</p>
          <p style="margin: 5px 0;"><span style="color: #6a6a6a; font-weight: 500;">Автор:</span> ${painting.artist?.artistName || 'Не указан'}</p>
          <p style="margin: 5px 0;"><span style="color: #6a6a6a; font-weight: 500;">Размер:</span> ${dimensions}</p>
          <p style="margin: 5px 0;"><span style="color: #6a6a6a; font-weight: 500;">Материалы:</span> ${materials}</p>
          <p style="margin: 5px 0;"><span style="color: #6a6a6a; font-weight: 500;">Год:</span> ${painting.yearOfCreation || 'Не указан'}</p>
        </div>
      </div>
      
      <div style="width: 170px; margin-left: auto; padding-left: 15px; border-left: 1px solid #eaeaea;">
        <div style="text-align: right;">
          ${
            originalPriceHTML
              ? `
            <div style="color: #878787; text-decoration: line-through; margin-bottom: 4px; font-size: 14px;">${originalPriceHTML}</div>
          `
              : ''
          }
          <div style="color: #ff3a44; font-weight: bold; font-size: 18px; margin-bottom: 4px;">${finalPrice} ₽</div>
          ${
            discountText
              ? `
            <div style="color: #ff3a44; font-weight: bold; font-size: 12px; text-align: right; line-height: 1.2;">${discountText}</div>
          `
              : ''
          }
        </div>
      </div>
    </div>
    `
  }

  /**
   * Вспомогательные методы для расчета цены
   */
  calculatePriceWithDiscount(price: number, discount: number): number {
    return Math.round(price - (price * discount) / 100)
  }

  calculateItemPrice(painting: Painting): number {
    switch (painting.priceType) {
      case 'Специальное предложение':
        return painting.price
      case 'Скидка':
        return this.calculatePriceWithDiscount(
          painting.price,
          painting.discount
        )
      default:
        return painting.discount
          ? this.calculatePriceWithDiscount(painting.price, painting.discount)
          : painting.price
    }
  }

  calculateTotalPrice(paintings: Painting[]): number {
    return paintings.reduce((sum, painting) => {
      return sum + this.calculateItemPrice(painting)
    }, 0)
  }
}

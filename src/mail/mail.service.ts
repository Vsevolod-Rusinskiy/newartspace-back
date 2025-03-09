import { Injectable, Logger } from '@nestjs/common'
import * as nodemailer from 'nodemailer'

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private transporter

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }
    })

    this.transporter.verify((error, success) => {
      console.log(success)
      if (error) {
        this.logger.error(`Mail configuration error: ${error.message}`)
      } else {
        this.logger.log('Mail server is ready to take our messages')
      }
    })
  }

  async sendMail(
    subject: string,
    toEmail: string,
    text: string,
    replyToEmail?: string
  ) {
    try {
      const mailOptions = {
        from: '"Новое пространство" <' + process.env.ADMIN_EMAIL + '>',
        to: toEmail,
        subject,
        text,
        replyTo: replyToEmail || process.env.ADMIN_EMAIL
      }

      const response = await this.transporter.sendMail(mailOptions)
      this.logger.log(`Email sent successfully to ${toEmail}`)
      return response
    } catch (error) {
      this.logger.error(`Failed to send email to ${toEmail}: ${error.message}`)
      throw error
    }
  }
}

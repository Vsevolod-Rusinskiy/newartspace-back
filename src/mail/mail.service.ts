import { Injectable, Logger } from '@nestjs/common'
import * as nodemailer from 'nodemailer'

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private transporter

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PW
      }
    })
  }

  async sendMail(subject: string, toEmail: string, otpText: string) {
    try {
      const mailOptions = {
        from: process.env.NODEMAILER_EMAIL,
        to: toEmail,
        subject: subject,
        text: otpText
      }

      return await new Promise((resolve, reject) => {
        this.transporter.sendMail(mailOptions, (err, response) => {
          if (err) {
            this.logger.error(
              `Failed to send email to ${toEmail}: ${err.message}`
            )
            reject(err)
          } else {
            this.logger.log(`Email sent successfully to ${toEmail}`)
            resolve(response)
          }
        })
      })
    } catch (error) {
      this.logger.error(`Error in sendMail: ${error.message}`)
      throw error
    }
  }
}

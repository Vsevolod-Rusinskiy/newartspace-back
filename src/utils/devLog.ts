export const devLog = (message: string, data?: any) => {
  console.log(process.env.NODE_ENV, 111)
  if (process.env.NODE_ENV === 'development') {
    console.log(message, data)
  }
}

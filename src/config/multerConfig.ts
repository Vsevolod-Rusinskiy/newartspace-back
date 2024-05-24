import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as multer from 'multer';

export const storage = multer.diskStorage({
  destination: './uploads/paintings',
  filename: (req, file, cb) => {
    const fileExtName = extname(file.originalname);
    const uniqueSuffix = uuidv4();
    cb(null, `${uniqueSuffix}${fileExtName}`);
  },
});

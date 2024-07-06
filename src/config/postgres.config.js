"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pgConfig = void 0;
var config_1 = require("@nestjs/config");
var enumConfig_1 = require("./enumConfig/enumConfig");
exports.pgConfig = (0, config_1.registerAs)(enumConfig_1.EnumConfig.DATABASE, function () {
    console.log("Connecting to database at ".concat(process.env.POSTGRES_HOST, ":").concat(process.env.POSTGRES_PORT));
    return {
        dialect: process.env.SQL_DIALECT || 'postgres',
        logging: process.env.SQL_LOGGING === 'true',
        host: process.env.POSTGRES_HOST,
        port: +process.env.POSTGRES_PORT,
        username: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_NAME,
        autoLoadEntities: true,
        synchronize: true,
    };
});

"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseConfig = void 0;
var config_1 = require("@nestjs/config");
var enumConfig_1 = require("./enumConfig/enumConfig");
var postgresConfig_1 = require("./postgresConfig");
exports.databaseConfig = (0, config_1.registerAs)(enumConfig_1.EnumConfig.DATABASE, function () { return ({
    pg: __assign({}, (0, postgresConfig_1.pgConfig)()),
}); });

"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Painting = void 0;
var sequelize_typescript_1 = require("sequelize-typescript");
var Painting = function () {
    var _classDecorators = [sequelize_typescript_1.Table];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _classSuper = sequelize_typescript_1.Model;
    var _paintingUrl_decorators;
    var _paintingUrl_initializers = [];
    var _paintingUrl_extraInitializers = [];
    var _name_decorators;
    var _name_initializers = [];
    var _name_extraInitializers = [];
    var _artType_decorators;
    var _artType_initializers = [];
    var _artType_extraInitializers = [];
    var _price_decorators;
    var _price_initializers = [];
    var _price_extraInitializers = [];
    var _theme_decorators;
    var _theme_initializers = [];
    var _theme_extraInitializers = [];
    var _style_decorators;
    var _style_initializers = [];
    var _style_extraInitializers = [];
    var _base_decorators;
    var _base_initializers = [];
    var _base_extraInitializers = [];
    var _materials_decorators;
    var _materials_initializers = [];
    var _materials_extraInitializers = [];
    var _dimensions_decorators;
    var _dimensions_initializers = [];
    var _dimensions_extraInitializers = [];
    var _yearOfCreation_decorators;
    var _yearOfCreation_initializers = [];
    var _yearOfCreation_extraInitializers = [];
    var _format_decorators;
    var _format_initializers = [];
    var _format_extraInitializers = [];
    var _color_decorators;
    var _color_initializers = [];
    var _color_extraInitializers = [];
    var Painting = _classThis = /** @class */ (function (_super) {
        __extends(Painting_1, _super);
        function Painting_1() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.paintingUrl = __runInitializers(_this, _paintingUrl_initializers, void 0);
            _this.name = (__runInitializers(_this, _paintingUrl_extraInitializers), __runInitializers(_this, _name_initializers, void 0));
            _this.artType = (__runInitializers(_this, _name_extraInitializers), __runInitializers(_this, _artType_initializers, void 0));
            _this.price = (__runInitializers(_this, _artType_extraInitializers), __runInitializers(_this, _price_initializers, void 0));
            _this.theme = (__runInitializers(_this, _price_extraInitializers), __runInitializers(_this, _theme_initializers, void 0));
            _this.style = (__runInitializers(_this, _theme_extraInitializers), __runInitializers(_this, _style_initializers, void 0));
            _this.base = (__runInitializers(_this, _style_extraInitializers), __runInitializers(_this, _base_initializers, void 0));
            _this.materials = (__runInitializers(_this, _base_extraInitializers), __runInitializers(_this, _materials_initializers, void 0));
            _this.dimensions = (__runInitializers(_this, _materials_extraInitializers), __runInitializers(_this, _dimensions_initializers, void 0));
            _this.yearOfCreation = (__runInitializers(_this, _dimensions_extraInitializers), __runInitializers(_this, _yearOfCreation_initializers, void 0));
            _this.format = (__runInitializers(_this, _yearOfCreation_extraInitializers), __runInitializers(_this, _format_initializers, void 0));
            _this.color = (__runInitializers(_this, _format_extraInitializers), __runInitializers(_this, _color_initializers, void 0));
            __runInitializers(_this, _color_extraInitializers);
            return _this;
        }
        return Painting_1;
    }(_classSuper));
    __setFunctionName(_classThis, "Painting");
    (function () {
        var _a;
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create((_a = _classSuper[Symbol.metadata]) !== null && _a !== void 0 ? _a : null) : void 0;
        _paintingUrl_decorators = [sequelize_typescript_1.Column];
        _name_decorators = [sequelize_typescript_1.Column];
        _artType_decorators = [sequelize_typescript_1.Column];
        _price_decorators = [sequelize_typescript_1.Column];
        _theme_decorators = [sequelize_typescript_1.Column];
        _style_decorators = [sequelize_typescript_1.Column];
        _base_decorators = [sequelize_typescript_1.Column];
        _materials_decorators = [sequelize_typescript_1.Column];
        _dimensions_decorators = [sequelize_typescript_1.Column];
        _yearOfCreation_decorators = [sequelize_typescript_1.Column];
        _format_decorators = [sequelize_typescript_1.Column];
        _color_decorators = [sequelize_typescript_1.Column];
        __esDecorate(null, null, _paintingUrl_decorators, { kind: "field", name: "paintingUrl", static: false, private: false, access: { has: function (obj) { return "paintingUrl" in obj; }, get: function (obj) { return obj.paintingUrl; }, set: function (obj, value) { obj.paintingUrl = value; } }, metadata: _metadata }, _paintingUrl_initializers, _paintingUrl_extraInitializers);
        __esDecorate(null, null, _name_decorators, { kind: "field", name: "name", static: false, private: false, access: { has: function (obj) { return "name" in obj; }, get: function (obj) { return obj.name; }, set: function (obj, value) { obj.name = value; } }, metadata: _metadata }, _name_initializers, _name_extraInitializers);
        __esDecorate(null, null, _artType_decorators, { kind: "field", name: "artType", static: false, private: false, access: { has: function (obj) { return "artType" in obj; }, get: function (obj) { return obj.artType; }, set: function (obj, value) { obj.artType = value; } }, metadata: _metadata }, _artType_initializers, _artType_extraInitializers);
        __esDecorate(null, null, _price_decorators, { kind: "field", name: "price", static: false, private: false, access: { has: function (obj) { return "price" in obj; }, get: function (obj) { return obj.price; }, set: function (obj, value) { obj.price = value; } }, metadata: _metadata }, _price_initializers, _price_extraInitializers);
        __esDecorate(null, null, _theme_decorators, { kind: "field", name: "theme", static: false, private: false, access: { has: function (obj) { return "theme" in obj; }, get: function (obj) { return obj.theme; }, set: function (obj, value) { obj.theme = value; } }, metadata: _metadata }, _theme_initializers, _theme_extraInitializers);
        __esDecorate(null, null, _style_decorators, { kind: "field", name: "style", static: false, private: false, access: { has: function (obj) { return "style" in obj; }, get: function (obj) { return obj.style; }, set: function (obj, value) { obj.style = value; } }, metadata: _metadata }, _style_initializers, _style_extraInitializers);
        __esDecorate(null, null, _base_decorators, { kind: "field", name: "base", static: false, private: false, access: { has: function (obj) { return "base" in obj; }, get: function (obj) { return obj.base; }, set: function (obj, value) { obj.base = value; } }, metadata: _metadata }, _base_initializers, _base_extraInitializers);
        __esDecorate(null, null, _materials_decorators, { kind: "field", name: "materials", static: false, private: false, access: { has: function (obj) { return "materials" in obj; }, get: function (obj) { return obj.materials; }, set: function (obj, value) { obj.materials = value; } }, metadata: _metadata }, _materials_initializers, _materials_extraInitializers);
        __esDecorate(null, null, _dimensions_decorators, { kind: "field", name: "dimensions", static: false, private: false, access: { has: function (obj) { return "dimensions" in obj; }, get: function (obj) { return obj.dimensions; }, set: function (obj, value) { obj.dimensions = value; } }, metadata: _metadata }, _dimensions_initializers, _dimensions_extraInitializers);
        __esDecorate(null, null, _yearOfCreation_decorators, { kind: "field", name: "yearOfCreation", static: false, private: false, access: { has: function (obj) { return "yearOfCreation" in obj; }, get: function (obj) { return obj.yearOfCreation; }, set: function (obj, value) { obj.yearOfCreation = value; } }, metadata: _metadata }, _yearOfCreation_initializers, _yearOfCreation_extraInitializers);
        __esDecorate(null, null, _format_decorators, { kind: "field", name: "format", static: false, private: false, access: { has: function (obj) { return "format" in obj; }, get: function (obj) { return obj.format; }, set: function (obj, value) { obj.format = value; } }, metadata: _metadata }, _format_initializers, _format_extraInitializers);
        __esDecorate(null, null, _color_decorators, { kind: "field", name: "color", static: false, private: false, access: { has: function (obj) { return "color" in obj; }, get: function (obj) { return obj.color; }, set: function (obj, value) { obj.color = value; } }, metadata: _metadata }, _color_initializers, _color_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Painting = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Painting = _classThis;
}();
exports.Painting = Painting;

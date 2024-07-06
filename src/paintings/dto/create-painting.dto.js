"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePaintingDto = void 0;
var class_validator_1 = require("class-validator");
var CreatePaintingDto = function () {
    var _a;
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
    return _a = /** @class */ (function () {
            function CreatePaintingDto() {
                this.paintingUrl = __runInitializers(this, _paintingUrl_initializers, void 0);
                this.name = (__runInitializers(this, _paintingUrl_extraInitializers), __runInitializers(this, _name_initializers, void 0));
                this.artType = (__runInitializers(this, _name_extraInitializers), __runInitializers(this, _artType_initializers, void 0));
                this.price = (__runInitializers(this, _artType_extraInitializers), __runInitializers(this, _price_initializers, void 0));
                this.theme = (__runInitializers(this, _price_extraInitializers), __runInitializers(this, _theme_initializers, void 0));
                this.style = (__runInitializers(this, _theme_extraInitializers), __runInitializers(this, _style_initializers, void 0));
                this.base = (__runInitializers(this, _style_extraInitializers), __runInitializers(this, _base_initializers, void 0));
                this.materials = (__runInitializers(this, _base_extraInitializers), __runInitializers(this, _materials_initializers, void 0));
                this.dimensions = (__runInitializers(this, _materials_extraInitializers), __runInitializers(this, _dimensions_initializers, void 0));
                this.yearOfCreation = (__runInitializers(this, _dimensions_extraInitializers), __runInitializers(this, _yearOfCreation_initializers, void 0));
                this.format = (__runInitializers(this, _yearOfCreation_extraInitializers), __runInitializers(this, _format_initializers, void 0));
                this.color = (__runInitializers(this, _format_extraInitializers), __runInitializers(this, _color_initializers, void 0));
                __runInitializers(this, _color_extraInitializers);
            }
            return CreatePaintingDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _paintingUrl_decorators = [(0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.IsString)()];
            _name_decorators = [(0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.IsString)()];
            _artType_decorators = [(0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.IsString)()];
            _price_decorators = [(0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.IsNumber)()];
            _theme_decorators = [(0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.IsString)()];
            _style_decorators = [(0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.IsString)()];
            _base_decorators = [(0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.IsString)()];
            _materials_decorators = [(0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.IsString)()];
            _dimensions_decorators = [(0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.IsString)()];
            _yearOfCreation_decorators = [(0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(1000), (0, class_validator_1.Max)(9999)];
            _format_decorators = [(0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.IsString)()];
            _color_decorators = [(0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.IsString)()];
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
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreatePaintingDto = CreatePaintingDto;

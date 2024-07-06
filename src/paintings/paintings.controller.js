"use strict";
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
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
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaintingsController = void 0;
var multerConfig_1 = require("../config/multerConfig");
var platform_express_1 = require("@nestjs/platform-express");
var common_1 = require("@nestjs/common");
var PaintingsController = function () {
    var _classDecorators = [(0, common_1.Controller)('paintings')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _getAllPaintings_decorators;
    var _getOnePainting_decorators;
    var _createPainting_decorators;
    var _updatePainting_decorators;
    var _deletePainting_decorators;
    var _deleteManyPaintings_decorators;
    var _uploadFile_decorators;
    var PaintingsController = _classThis = /** @class */ (function () {
        function PaintingsController_1(paintingService) {
            this.paintingService = (__runInitializers(this, _instanceExtraInitializers), paintingService);
        }
        PaintingsController_1.prototype.getAllPaintings = function () {
            return this.paintingService.findAll();
        };
        PaintingsController_1.prototype.getOnePainting = function (id) {
            return this.paintingService.findOne(id);
        };
        PaintingsController_1.prototype.createPainting = function (createPainting) {
            return this.paintingService.create(createPainting);
        };
        PaintingsController_1.prototype.updatePainting = function (updatePainting, id) {
            return this.paintingService.update(+id, updatePainting);
        };
        PaintingsController_1.prototype.deletePainting = function (id) {
            return this.paintingService.delete(id);
        };
        PaintingsController_1.prototype.deleteManyPaintings = function (ids) {
            var idArray = JSON.parse(ids);
            return this.paintingService.deleteMany(idArray);
        };
        PaintingsController_1.prototype.uploadFile = function (file) {
            console.log(file);
            return {
                id: file.filename.split('.')[0],
                originalName: file.originalname,
                filename: file.filename,
                path: file.path,
            };
        };
        return PaintingsController_1;
    }());
    __setFunctionName(_classThis, "PaintingsController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _getAllPaintings_decorators = [(0, common_1.Get)()];
        _getOnePainting_decorators = [(0, common_1.Get)(':id')];
        _createPainting_decorators = [(0, common_1.Post)(), (0, common_1.HttpCode)(common_1.HttpStatus.CREATED), (0, common_1.Header)('Content-Type', 'application/json')];
        _updatePainting_decorators = [(0, common_1.Patch)(':id')];
        _deletePainting_decorators = [(0, common_1.Delete)(':id')];
        _deleteManyPaintings_decorators = [(0, common_1.Delete)('deleteMany/:ids')];
        _uploadFile_decorators = [(0, common_1.Post)('upload'), (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { storage: multerConfig_1.storage }))];
        __esDecorate(_classThis, null, _getAllPaintings_decorators, { kind: "method", name: "getAllPaintings", static: false, private: false, access: { has: function (obj) { return "getAllPaintings" in obj; }, get: function (obj) { return obj.getAllPaintings; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getOnePainting_decorators, { kind: "method", name: "getOnePainting", static: false, private: false, access: { has: function (obj) { return "getOnePainting" in obj; }, get: function (obj) { return obj.getOnePainting; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _createPainting_decorators, { kind: "method", name: "createPainting", static: false, private: false, access: { has: function (obj) { return "createPainting" in obj; }, get: function (obj) { return obj.createPainting; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updatePainting_decorators, { kind: "method", name: "updatePainting", static: false, private: false, access: { has: function (obj) { return "updatePainting" in obj; }, get: function (obj) { return obj.updatePainting; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _deletePainting_decorators, { kind: "method", name: "deletePainting", static: false, private: false, access: { has: function (obj) { return "deletePainting" in obj; }, get: function (obj) { return obj.deletePainting; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _deleteManyPaintings_decorators, { kind: "method", name: "deleteManyPaintings", static: false, private: false, access: { has: function (obj) { return "deleteManyPaintings" in obj; }, get: function (obj) { return obj.deleteManyPaintings; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _uploadFile_decorators, { kind: "method", name: "uploadFile", static: false, private: false, access: { has: function (obj) { return "uploadFile" in obj; }, get: function (obj) { return obj.uploadFile; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        PaintingsController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return PaintingsController = _classThis;
}();
exports.PaintingsController = PaintingsController;

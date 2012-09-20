/**
 * Copyright 2012 Martin Gallagher
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */
(function ($, undefined) {
	'use strict';

	/**
	 * Draw image onto canvas
	 * @param {String|Image} image
	 * @param {Object} canvas
	 * @param {Function} func
	 */
	function toCanvas(image, canvas, func) {
		if (Type.isElement(canvas) && canvas.nodeName === 'CANVAS') {
			if (Type.isString(image)) {
				var src = image;

				image = new Image();
				image.src = src;
			}

			if (Type.isImage(image)) {
				image.onload = function () {
					canvas.width = image.width;
					canvas.height = image.height;

					var context = canvas.getContext('2d');

					context.drawImage(image, 0, 0, image.width, image.height);

					if (func !== undefined && Type.isFunction(func)) {
						func();
					}
				};
			}
		}
	}

	$.toCanvas = toCanvas;

	/**
	 * Canvas object constructor
	 * @constructor
	 * @param {Object} canvas
	 * @return {Canvas|null}
	 */
	function Canvas(canvas) {
		if (Type.isElement(canvas) && canvas.nodeName === 'CANVAS') {
			this.element = canvas;
			this.context = canvas.getContext('2d');
			this.content = this.context.getImageData(0, 0, canvas.width, canvas.height);
			this.data = this.content.data;
			this.width = canvas.width;
			this.height = canvas.height;
			this.length = canvas.width * canvas.height;

			return this;
		}

		return null;
	}

	$.Canvas = Canvas;

	Canvas.prototype.element = undefined;
	Canvas.prototype.context = undefined;
	Canvas.prototype.content = undefined;
	Canvas.prototype.data = undefined;
	Canvas.prototype.width = undefined;
	Canvas.prototype.height = undefined;
	Canvas.prototype.length = undefined;

	/**
	 * Check whether the Canvas object values are set
	 * @returns {Boolean}
	 */
	Canvas.prototype.isSet = function () {
		return this.length > 0;
	};

	/**
	 * Apply filter to canvas
	 * @param {Function|String} func
	 * @param {Array} args
	 */
	Canvas.prototype.filter = function (func, args) {
		if (this.isSet()) {
			func = Type.isFunction(func) ? func : $[func];

			if (Type.isFunction(func)) {
				var len = this.length;
				var px, color;

				while (--len) {
					px = 4 * len;
					color = func.apply(null, [new RGBA(this.data[px], this.data[px + 1], this.data[px + 2], this.data[px + 3] / 255)].concat(args));
					this.data[px] = color.red;
					this.data[px + 1] = color.green;
					this.data[px + 2] = color.blue;
					this.data[px + 3] = Math.round(color.alpha * 255);
				}

				this.context.putImageData(this.content, 0, 0);
			}
		}
	};

	/**
	 * Apply filter to canvas using RGB prototype functions
	 * @param {Function|String} func
	 * @param {Array} args
	 */
	Canvas.prototype.filterUsingRGBA = function (func, args) {
		if (this.isSet()) {
			if (Type.isFunction(RGBA.prototype[func])) {
				var len = this.length;
				var px, color;

				while (--len) {
					px = 4 * len;
					color = new RGBA(this.data[px], this.data[px + 1], this.data[px + 2], this.data[px + 3] / 255);

					// Call prototype method
					color[func].apply(color, [args]);

					this.data[px] = color.red;
					this.data[px + 1] = color.green;
					this.data[px + 2] = color.blue;
					this.data[px + 3] = Math.round(color.alpha * 255);
				}

				this.context.putImageData(this.content, 0, 0);
			}
		}
	};

	/**
	 * Blur canvas contents
	 * @param {Number} passes
	 */
	Canvas.prototype.blur = function (passes) {
		if (this.isSet()) {
			passes = !passes || !Type.isInteger(passes) ? 1 : passes;
			this.context.globalAlpha = 0.125;

			while (passes--) {
				for (var x = -1; x < 2; x++) {
					for (var y = -1; y < 2; y++) {
						this.context.drawImage(this.element, x, y);
					}
				}
			}

			this.context.globalAlpha = 1.0;
		}
	};

	/**
	 * Get the canvas colors and frequency
	 * @param {Boolean} useHex If true, use solid Hex colors
	 * @param {Number} minimum The magnitude at which pixels can decay away from their origin
	 * @returns {Object<String, Number>}
	 */
	Canvas.prototype.getColors = function (useHex, minimum) {
		if (this.isSet()) {
			var len = this.length;
			var out = {};
			var px, getColor;

			if (useHex !== true) {
				getColor = function (red, green, blue, alpha) {
					return new RGBA(red, green, blue, alpha);
				};


			} else {
				getColor = function (red, green, blue, alpha) {
					return new RGBA(red, green, blue, alpha).toHex();
				};
			}

			var push = function (red, green, blue, alpha) {
				var color = getColor(red, green, blue, alpha);
				var id = color.toString();

				if (!out.hasOwnProperty(id)) {
					out[id] = 1;
				} else {
					out[id] += 1;
				}
			};

			while (--len) {
				px = 4 * len;

				// Push to output
				push(this.data[px], this.data[px + 1], this.data[px + 2], this.data[px + 3] / 255);
			}

			if (minimum !== undefined && Type.isInteger(minimum) && minimum > 0) {
				for (var color in out) {
					if (out.hasOwnProperty(color) && out[color] < minimum) {
						delete out[color];
					}
				}
			}

			return out;
		}

		return null;
	};

	/**
	 * Add noise by mutating pixels
	 * @param {Number} passes
	 * @param {Number} decay The magnitude at which pixels can decay away from their origin
	 */
	Canvas.prototype.noise = function (passes, decay) {
		if (this.isSet()) {
			passes = !passes || !Type.isInteger(passes) ? 1 : passes;
			decay = !decay || !Type.isNumber(decay) ? 0.05 : decay;

			while (passes--) {
				this.filterUsingRGBA('mutate', decay);
			}
		}
	};

	/**
	 * Primitive function to make a image look "old"
	 */
	Canvas.prototype.age = function () {
		if (this.isSet()) {
			this.filter(mutate, 0.05);
			this.blur(1);
		}
	};

	/**
	 * Mix the canvas colors with a given color
	 * @param {Object|String} color
	 */
	Canvas.prototype.mix = function (color) {
		if (this.isSet()) {
			// mix() uses RGB for calculations, improve performance by passing RGB object
			color = new RGB(color);

			this.filter(mix, color);
		}
	};

	/**
	 * Swap pixel colors with their complementary
	 */
	Canvas.prototype.complement = function () {
		this.filter(complement);
	};

	/**
	 * Invert canvas colors
	 */
	Canvas.prototype.invert = function () {
		this.filter(invert);
	};

	/**
	 * Saturate canvas colors
	 * @param {Number} multiplier
	 */
	Canvas.prototype.saturate = function (multiplier) {
		this.filter(saturate, multiplier);
	};

	/**
	 * Desaturate canvas colors
	 * @param {Number} multiplier
	 */
	Canvas.prototype.desaturate = function (multiplier) {
		this.filter(desaturate, multiplier);
	};

	/**
	 * Grayscale (fully desaturate) canvas colors
	 */
	Canvas.prototype.grayscale = function () {
		this.filter(grayscale);
	};
})(this);
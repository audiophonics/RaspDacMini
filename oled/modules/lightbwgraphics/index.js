const fs = require("fs");
const fonts = require('basicfonts');

function chunkString(str, length){ // helper pour tronquer facilement du texte
	return str.match(new RegExp('.{1,' + length + '}', 'g'));
}


function GRAPHICS() {
	this.cursor_x = 0;
	this.cursor_y = 0;
	this.fonts = fonts;
}

GRAPHICS.prototype.attachDriver = function(driver) {
	
	this.drawPixel =(x,y)=> driver.drawPixel(x,y);
	this.update =()=> driver.update();
	this.turnOnDisplay =()=> driver.turnOnDisplay();
	this.turnOffDisplay =()=> driver.turnOffDisplay();
	this.setContrast =(v)=> driver.setContrast(v);
	
	
	this.buffer = driver.buffer;
	this.WIDTH = driver.width;
	this.HEIGHT = driver.height;
	return this;
}

GRAPHICS.prototype.clearBuffer = function(x, y) {
	this.buffer.fill(0x00);
}


GRAPHICS.prototype.setCursor = function(x, y) {
	this.cursor_x = x;
	this.cursor_y = y;
}



GRAPHICS.prototype.writeString = function(font_name, size, string) {
	
	font_name = font_name || "monospace";
	if(!this.fonts[font_name]) font = this.fonts["monospace"];
	else font = this.fonts[font_name];
	
	
  var wordArr = string.split(' '),
      len = wordArr.length,
      offset = this.cursor_x,
      padding = 0, letspace = 0, leading = 2;

  for (var w = 0; w < len; w += 1) {
    wordArr[w] += ' ';
    var stringArr = wordArr[w].split(''),
        slen = stringArr.length,
        compare = (font.width * size * slen) + (size * (len -1));

    for (var i = 0; i < slen; i += 1) {
      var charBuf = this._findCharBuf(font, stringArr[i]);
      var charBytes = this._readCharBytes(charBuf);
      this._drawChar(charBytes, size);
      padding = size + letspace;
      offset += (font.width * size) + padding;
      this.setCursor(offset, this.cursor_y);
    }
  }
}

GRAPHICS.prototype._drawChar = function(byteArray, size) {
	let x = this.cursor_x,
	y = this.cursor_y;

	for (var i = 0; i < byteArray.length; i += 1) {
		for (var j = 0; j < 8; j += 1) {
			let color = byteArray[i][j],
			xpos,
			ypos;
			if( !color ) continue;
			if (size === 1) {
				xpos = x + i;
				ypos = y + j;
				this.drawPixel(xpos, ypos);
			} else{
				xpos = x + (i * size);
				ypos = y + (j * size);
				this.fillRect(xpos, ypos, size, size );
			}
		}
	}
}

// UNICODE SUPPORT
GRAPHICS.prototype.load_hex_font = function(fontpath,callback){
	this.hex_font = {};
	fs.readFile("unifont.hex",(err,data)=>{
		let unichars = data.toString().split("\n");
		for(let unichar of unichars){
			let code = parseInt(unichar.substring(0,4),16),
			value = unichar.substring(5);
			if(code){
				let splitval,
				columns = 0,
				row_length = 0;
				if( value.length === 64 ){ 
					columns = 4;
					row_length = 16;
				}
				else{ 
					columns = 2;
					row_length = 8;
				}
				splitval = chunkString(value,columns);
				for(let i in splitval){
					splitval[i] = parseInt(splitval[i],16)
				}
				this.hex_font[code] = {
					data : splitval,
					length : row_length
				}
			};
		}
		if(typeof callback === "function") {
			callback();
		}
	});
}

GRAPHICS.prototype.CacheGlyphsData = function(string){
	this.cached_glyph = {};
	if(!this.hex_font){console.log("font not loaded"); return}
	let used_chars = new Set(string);
	for(used_char of used_chars){
		let height = 0,
		binary_glyph = [],
		binary_row_string = "",
		glyph_raw_data = this.hex_font[used_char.charCodeAt()];

		if(glyph_raw_data){
				let data = glyph_raw_data.data,
				length = glyph_raw_data.length;
				for (var i = 0; i < data.length ; i += 1) {
					height++;
					binary_row_string = data[i].toString(2);
					while( binary_row_string.length < length ){ binary_row_string = "0" + binary_row_string; }
					binary_glyph.push(binary_row_string);
				}
		}

		this.cached_glyph[used_char] = {
			data : binary_glyph,
			width : binary_row_string.length,
			height : height
		};
	}
}
GRAPHICS.prototype.writeStringUnifont = function(string,color) {
	color = 1;
	
	let temp_cursor = this.cursor_x;
    for (var i = 0; i < string.length ; i += 1) {
		if(!this.hex_font){console.log("font not loaded"); return}
		if(this.cursor_x  >= this.WIDTH){return}

		var charBuf = this.cached_glyph[string[i]];
		if(!charBuf || this.cursor_x+charBuf.width <= 0){
			let spacing = (charBuf && charBuf.width) ? charBuf.width : 8;
			this.setCursor( this.cursor_x + spacing , this.cursor_y );
			continue;
		}
		this._drawCharUnifont(charBuf,color);
		this.setCursor(this.cursor_x+charBuf.width,this.cursor_y);
    }
}

GRAPHICS.prototype.getStringWidthUnifont = function(string) {
	
	if(!string || !string.length) return 0;
	let width = 0;
    for (var i = 0; i < string.length ; i += 1) {
		if(!this.hex_font){console.log("font not loaded"); return}
		var charBuf = this.hex_font[string[i].charCodeAt()];
		if(!charBuf) continue;
		width += charBuf.length;
    }
	return width;
}


GRAPHICS.prototype._drawCharUnifont = function(buf) {
	let y = this.cursor_x, // inversé parce (buf data est encodé en ligne plutôt qu'en colonnes).
		x = this.cursor_y,
		d = buf.data
	for (let i = 0; i < buf.height; i += 1) {
		for (let j = 0; j < buf.width; j += 1) {
			if(d[i][j] === "1") this.drawPixel(y + j,x + i,1);
		}
	}
}

GRAPHICS.prototype._readCharBytes = function(byteArray) {
	var bitArr = [],
		bitCharArr = [];
	for (var i = 0; i < byteArray.length; i += 1) {
		var byte = byteArray[i];
		for (var j = 0; j < 8; j += 1) {
			var bit = byte >> j & 1;
			bitArr.push(bit);
		}
		bitCharArr.push(bitArr);
		bitArr = [];
	}
	return bitCharArr;
}

GRAPHICS.prototype._findCharBuf = function(font, c) {
	var cBufPos = font.lookup.indexOf(c) * font.width;
	var cBuf = font.fontData.slice(cBufPos, cBufPos + font.width);
	return cBuf;
}

GRAPHICS.prototype.drawLine = function(x0, y0, x1, y1) {
	let dx = Math.abs(x1 - x0),
		sx = x0 < x1 ? 1 : -1,
		dy = Math.abs(y1 - y0), 
		sy = y0 < y1 ? 1 : -1,
		err = (dx > dy ? dx : -dy) / 2;
	while (true) {
		this.drawPixel(x0, y0,1);
		if (x0 === x1 && y0 === y1) break;
		let e2 = err;
		if (e2 > -dx) {err -= dy; x0 += sx;}
		if (e2 < dy) {err += dx; y0 += sy;}
	}
}

GRAPHICS.prototype.fillRect = function(x, y, w, h) {
	for (let i = x; i < x + w; i += 1) this.drawLine(i, y, i, y+h-1);
}

GRAPHICS.prototype.load_and_display_logo = function(callback){
	callback = callback || function(){}
	fs.readFile("logo.logo",(err,data)=>{
		try{
			data = data.toString().split("\n");
			let flip = true;
			let p = 0;
			for(let d of data){
				while(d--){
					if(flip) this.drawPixel( p % this.WIDTH ,  ~~( p / this.WIDTH )  );
					p++;
				}
				flip = !flip;
			}
			this.update();
			callback(true);
		}
		catch(e){
			console.log("error while displaying logo")
			callback(false);
		}
	});
}

module.exports.GRAPHICS = GRAPHICS;
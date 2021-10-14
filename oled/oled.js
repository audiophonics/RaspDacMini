var spi = require('pi-spi');
var Gpio = require('onoff').Gpio;
var async = require('async');
const fs = require("fs");


function chunkString(str, length){ // helper pour tronquer facilement du texte
	return str.match(new RegExp('.{1,' + length + '}', 'g'));
}

var Oled = function(opts) {

	this.HEIGHT = opts.height || 32;
	this.WIDTH = opts.width || 128;
	this.dcPinNumber = opts.dcPin || 23;
	this.rstPinNumber = opts.rstPin || 24;
	this.device = opts.device || "/dev/spidev0.0";
	this.DISPLAY_OFF = 0xAE;
	this.DISPLAY_ON = 0xAF;
	this.SEG_REMAP = (opts.flip)&&0xDA||0xA1; // retourner l'écran si flip est true
	this.SET_CONTRAST = 0x81;

	this.cursor_x = 0;
	this.cursor_y = 0;

	this.buffer = new Buffer((this.WIDTH * this.HEIGHT) / 8); // framebuffer
	this.buffer.fill(0x00);

	this.updateInProgress = false;
	this.hex_font = {};
	this.contrast = (opts.contrast) || 0x00;

	var screenSize = this.WIDTH + 'x' + this.HEIGHT;
	this.wireSPI = spi.initialize(this.device); // handle spi
}

Oled.prototype.begin = function(fn) {
	
	this.dcPin = new Gpio(this.dcPinNumber, 'low');
	
	this.rstPin = new Gpio(this.rstPinNumber, 'high');
	
	setTimeout(
		()=>{
			this.reset(
				()=>{
					this._initialise(()=>{
						this.buffer.fill(0x00);
						this.update(fn);
					});
				}
			);
		},
		1
	);
}

Oled.prototype.end = function() {
  this.dcPin.unexport();
  this.rstPin.unexport();
}

Oled.prototype.fullRAMclear = function(callback,overwrite){
	for(x = 0; x < this.WIDTH; x++){
		for(y = 0; y < this.HEIGHT; y++){
			this.drawPixel(x,y,0,overwrite);
		}
	}
	this.update( ()=>{
		if(typeof callback === "function") callback();
	});
}


Oled.prototype._initialise = function(callback) {
	this.send_instruction_seq( 
		[
			{ 
				val : Buffer.from([ 174,213,16,168,63,211,0,0,141,20,32,0,this.SEG_REMAP,200,218,18,129,this.contrast,217,241,219,64,164,166 ])
			}
		] 
		, callback);
}

Oled.prototype.send_instruction_seq = function(s,callback,index){
	
	
	index = index || 0;
	let current = s[index];
	if( !current ){ 
		typeof callback === "function" && callback();
		return;
	}
	index++;
	
	if( current["dc"] ){
		this.dcPin.write(1, (err)=>{
			if (err) console.error(err, d);
			this.send_instruction_seq(s,callback,index);
		});
	}
	else if( current["cd"] ){
		this.dcPin.write(0, (err)=>{
			if (err) console.error(err, d);
			this.send_instruction_seq(s,callback,index);
		});
	}
	else{
		if( typeof current.val !== 'object' ) current.val = Buffer.from([current.val]);
		this.wireSPI.write( current.val , (err, d)=> {
			if (err) console.error(err, d);
			this.send_instruction_seq(s,callback,index);
		});
	}
}



Oled.prototype.reset = function(fn) {
  var that = this;
  async.series([
    function(callback){
      that.rstPin.write(0,callback);
    },
    function(callback){
      setTimeout(callback, 10);
    },
    function(callback){
      that.rstPin.write(1,callback);
    }
  ], function(err){
    if (err) console.error(err);
    if (typeof(fn) == "function") fn();
  });
}

Oled.prototype.setCursor = function(x, y) {
  this.cursor_x = x;
  this.cursor_y = y;
}

Oled.prototype.writeString = function(font, size, string) {
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

Oled.prototype._drawChar = function(byteArray, size) {
  var x = this.cursor_x,
      y = this.cursor_y;

  for (var i = 0; i < byteArray.length; i += 1) {
    for (var j = 0; j < 8; j += 1) {
      var color = byteArray[i][j],
          xpos, ypos;
		if (size === 1) {
			xpos = x + i;
			ypos = y + j;
			this.drawPixel(xpos, ypos, color);
		} else if(color){
			xpos = x + (i * size);
			ypos = y + (j * size);
			this.fillRect(xpos, ypos, size, size);
		}
	
    }
  }
}

// UNICODE SUPPORT
Oled.prototype.load_hex_font = function(fontpath,callback){
	this.hex_font = {};
	fs.readFile("unifont.hex",(err,data)=>{
		let unichars = data.toString().split("\n");
		for(let unichar of unichars){
			let code = parseInt(unichar.substring(0,4),16);
			let value = unichar.substring(5);
			if(code){
				let splitval;
				let columns = 0;
				let row_length = 0;
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

Oled.prototype.CacheGlyphsData = function(string){
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
Oled.prototype.writeStringUnifont = function(string,color) {
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

Oled.prototype.getStringWidthUnifont = function(string) {
	
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


Oled.prototype._drawCharUnifont = function(buf,color) {
	var y = this.cursor_x, // inversé parce (buf data est encodé en ligne plutôt qu'en colonnes).
		x = this.cursor_y,
		d = buf.data
	for (var i = 0; i < buf.height; i += 1) {
		for (var j = 0; j < buf.width; j += 1) {
			this.drawPixel(y + j,x + i, d[i][j] * color);
		}
	}
}

Oled.prototype._readCharBytes = function(byteArray) {
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

Oled.prototype._findCharBuf = function(font, c) {
  var cBufPos = font.lookup.indexOf(c) * font.width;
  var cBuf = font.fontData.slice(cBufPos, cBufPos + font.width);
  return cBuf;
}

// afficher le framebuffer à l'écran
Oled.prototype.update = function(callback){
	if(this.updateInProgress){
		console.log("bounce")
		if(typeof callback === "function") callback();
		return;
	}
	this.updateInProgress = true;

	let displaySeq = [ 
		0x21,
		0,
		this.WIDTH - 1, 
		0x22, 0, (this.HEIGHT / 8) - 1 
	];

	this.send_instruction_seq( 
	[
		{ val : Buffer.from(displaySeq) }, 
		{ "dc" : true }, 
		{ val : this.buffer }, 
		{ "cd" : true }, 
	], ()=>{
			this.updateInProgress = false;
			if(typeof callback === "function") callback();
	} );

}

Oled.prototype.setContrast = function(value) {
	this.send_instruction_seq( [ { val : Buffer.from([this.SET_CONTRAST, value]) } ] );
}

Oled.prototype.turnOffDisplay = function() {
	this.send_instruction_seq( [ { val : Buffer.from([this.DISPLAY_OFF]) } ] );
}

Oled.prototype.turnOnDisplay = function() {
	this.send_instruction_seq( [ { val : Buffer.from([this.DISPLAY_ON]) } ] );
}

Oled.prototype.drawPixel = function(x,y,color) {
    
    if (	
			!color || 
            x >= this.WIDTH  || 
            y >= this.HEIGHT || 
            x < 0 ||
			y < 0
        ){ 
            return; // Ne rien faire si le pixel n'est pas dans l'espace de l'écran
        } 

    let byte = 0,
    page = Math.floor(y / 8);
    (page == 0) ? byte = x : byte = x + (this.WIDTH * page);
    this.buffer[byte] |= 0x01 << (y - 8 * page);

}

Oled.prototype.drawLine = function(x0, y0, x1, y1) {
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

Oled.prototype.fillRect = function(x, y, w, h) {
	for (let i = x; i < x + w; i += 1) this.drawLine(i, y, i, y+h-1);
}

Oled.prototype.load_and_display_logo = function(callback){
	callback = callback || function(){}
	fs.readFile("logo.logo",(err,data)=>{
		try{
			data = data.toString().split("\n");
			let flip = true;
			let p = 0;
			for(let d of data){
				while(d--){
					this.drawPixel( p % this.WIDTH ,  ~~( p / this.WIDTH ) , flip );
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

module.exports = Oled;

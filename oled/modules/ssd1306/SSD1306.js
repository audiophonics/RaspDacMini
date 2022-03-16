const rpio = require("rpio");
const fastwrite = b => rpio.spiWrite(b,b.length);

module.exports.driver = SSD1306;
	
function SSD1306(options){
	
	let parse_options = (key,default_val) =>  this[key] = ( options && options[key] )?options[key] : default_val;
	
	// set the SSD1306 controller parameters
	parse_options( "width"			, 128 );
	parse_options( "height"			, 64 );
	parse_options( "muxratio"		, 63 );
	parse_options( "offset"			, 0 );
	parse_options( "comshift"		, 0 );
	parse_options( "constrast"		, 0 );
	parse_options( "regmode"		, 0 );
	parse_options( "oscfreq"		, 0x80 );
	parse_options( "regulval"		, 0x14 );
	
	// target the correct GPIO pins 
	parse_options( "GPIO_dcpin"		, 27 );
	parse_options( "GPIO_rstpin"	, 24 );
	
	parse_options( "rpioCS"			, 0 );
	parse_options( "rpioClock"		, 128 );
	parse_options( "rpioCloseOnExit", true );
	
	rpio.init({
		gpiomem: false,
		mapping: 'gpio',
		mock: undefined,
		close_on_exit: this.rpioCloseOnExit,
	});
	
	rpio.spiBegin();
	rpio.spiChipSelect( this.rpioCS );                  
	rpio.spiSetCSPolarity( 0, rpio.LOW );    
	rpio.spiSetClockDivider( this.rpioClock );           
	rpio.spiSetDataMode(0);

	rpio.open(	this.GPIO_dcpin		, rpio.OUTPUT	, rpio.PULL_DOWN);
	rpio.open(	this.GPIO_rstpin	, rpio.OUTPUT	, rpio.HIGH		);
	rpio.write(	this.GPIO_dcpin		, rpio.LOW						);
	
	this._reset();
	
	this._bufsize = this.width * this.height / 8;
	this.buffer = Buffer.alloc( this._bufsize );
	this.buffer.fill(0x00);
	
	this.DISPLAY_ON		 		= 0xAF;
	this.DISPLAY_OFF 	 		= 0xAE;
	this.NORMAL_MODE 	 		= 0xA6;
	this.BLANK_ALL 		 		= 0xA5;
	this.ENABLE_READ_FROM_RAM 	= 0xA4;
	this.SET_MUX_RATIO 			= 0xA8;
	this.SET_OFFSET 			= 0xD3; 
	this.SET_START_LINE 		= 0x40;
	this.SET_SEGMENT_REMAP 		= 0xA0; // horizontal flip
	this.COMSCANDIR 			= 0xC0; // vertical flip
	this.COMPINCONF 			= 0xD3; // vertical shift
	this.SETCONTRASTCONTROL		= 0x81;
	this.SETOSCFREQ				= 0xD5;
	this.ENABLEREGUL			= 0x8D;
	this.REGISTER_MODE			= 0x20;
	this.SET_COL_BOUNDARIES		= 0x21;	// 2 arguments : start col, end col (DC pin should stay low)
	this.SET_PAGES_BOUNDARIES	= 0x22;	// 2 arguments : start row, end row (DC pin should stay low)

	this.write_buffer = this._write_buffer();
	
	fastwrite( this._init_buffer() );
	fastwrite( this.write_buffer );
	
}



SSD1306.prototype.turnOffDisplay = function(){
	fastwrite( Buffer.from([ this.DISPLAY_OFF]) );
}

SSD1306.prototype.turnOnDisplay = function(){
	fastwrite( Buffer.from([ this.DISPLAY_ON]) );
}

SSD1306.prototype.setContrast = function(contrastValue){
	if(contrastValue >= 0 && contrastValue < 255)
		fastwrite( Buffer.from([ this.SETCONTRASTCONTROL, contrastValue]) );
}

SSD1306.prototype._reset = function(){
	rpio.write(this.GPIO_rstpin, rpio.LOW);
	rpio.write(this.GPIO_rstpin, rpio.HIGH);
}

SSD1306.prototype.drawPixel = function(x,y){
	if(
		x < 0 || x >= this.width ||
		y < 0 || y >= this.height
	)
	return;
    let page = Math.floor(y / 8),
    b = (page == 0) ?  x : x + (this.width * page);
    this.buffer[b] |= 0x01 << (y - 8 * page);
}

SSD1306.prototype.update = function(){
	fastwrite( this.write_buffer );
	rpio.write(		this.GPIO_dcpin	, rpio.HIGH 	);
	rpio.spiWrite(	this.buffer		, this._bufsize );
	rpio.write( 	this.GPIO_dcpin	, rpio.LOW 		);
}

SSD1306.prototype._init_buffer = function(){
	return Buffer.from([	
		this.SET_MUX_RATIO			, this.muxratio	, 
		this.SET_OFFSET				, this.offset	, 
		this.SET_START_LINE,	
		this.SET_START_LINE,	
		this.SET_SEGMENT_REMAP		, 
		this.COMSCANDIR				, 
		this.COMPINCONF				, this.comshift	, 
		this.SETCONTRASTCONTROL		, this.contrast	,
		this.REGISTER_MODE			, this.regmode	,
		this.ENABLE_READ_FROM_RAM	,
		this.NORMAL_MODE			,
		this.SETOSCFREQ				, this.oscfreq	,
		this.ENABLEREGUL			, this.regulval	,
		this.DISPLAY_ON
	]);
}

SSD1306.prototype._write_buffer = function(){
	return Buffer.from([	
		this.SET_COL_BOUNDARIES		, 0 , 127 ,
		this.SET_PAGES_BOUNDARIES	, 0 , ( this.height / 8 ) - 1
	]);
}







	
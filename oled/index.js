const os = require("os");
const date = require('date-and-time');
const oled = require('./oled.js');
const fonts = require('./fonts.js');
const fs = require("fs");
const http = require("http");

var DRIVER;

var TIME_BEFORE_CLOCK = 10000; // in ms
var TIME_BEFORE_SCREENSAVER = 20000; // in ms
var TIME_BEFORE_DEEPSLEEP = 120000; // in ms
var LOGO_DURATION = 5000; // in ms
var CONTRAST = 80; // range 1-254
var extn_exit_sleep_mode = false;

const opts = {
  width: 128,
  height: 64,
  dcPin: 27,
  rstPin : 24,
  contrast : CONTRAST,
  flip : true,
  device: "/dev/spidev0.0"
};

const distro = process.argv[2],
supported_distributions = ["volumio","moode"];
if(!distro || !supported_distributions.includes(distro) ){
	console.warn("Unknown target distribution : ",distro, "\nHere are the supported distributions : ", supported_distributions.join() );
}

switch (distro) {
	case 'moode':
	opts.divisor = 16;
	opts.main_rate = 50;
	break;
	case 'volumio':
	opts.divisor = 16;
	opts.main_rate = 40;
	break;
	default:
	opts.divisor = 16;
	opts.main_rate = 50;
}

http.createServer(server).listen(4153);
function server(req,res){
	let cmd = req.url.split("\/")[1];
	value = cmd.split("=");
	cmd = value[0];
	value = value[1];
	extn_exit_sleep_mode = true;
	
	switch(cmd){
		case 'restart':
			res.end("1");
			process.exit(0);
			break;
		case 'contrast':
			if(value < 255 && value > 0 ){
				res.end("1");
				DRIVER.driver.setContrast(value);
				CONTRAST = value;
			}
			break;
		case 'sleep_after':
			TIME_BEFORE_SCREENSAVER = value;
			break;
		case 'deep_sleep_after':
			TIME_BEFORE_DEEPSLEEP = value;
			break;
		case 'input':
			if(value === "SPDIF"){DRIVER.spdif_mode();}
			else DRIVER.playback_mode();
			break;
	}
	
}

const REFRESH_TRACK = 80;
var api_state_waiting = false; 

function ap_oled(opts){
	this.scroller_x = 0;
	this.streamerData = {};
	this.ip = null;
	this.height = opts.height;
	this.width = opts.width;
	this.page = null;
    this.data = {
        title : null,
        artist : null,
        album : null,
        volume : null,
        samplerate : null,
        bitdepth : null,
        bitrate : null,
		seek : null,
		duration : null
    };
	this.raw_seek_value = 0;
	this.footertext = "";
	this.update_interval = null;
    this.refresh_track = REFRESH_TRACK;
	this.refresh_action = null;
	this.driver = new oled(opts);

}

ap_oled.prototype.volumio_seek_format = function (seek,duration){
	try{
		if(!duration) ratiobar = 0;
		else ratiobar =  ( seek / (duration * 1000) * (this.width - 6) );
	}
	catch(e){
		ratiobar = 0;
	}	
	try{
		duration = new Date(duration * 1000).toISOString().substr(14, 5);
	}
	catch(e){
		duration = "00:00";
	}
	try{
		seek = new Date(seek).toISOString().substr(14, 5);
	}
	catch(e){
		seek = "";
	}
	seek_string = seek + " / "+ duration;
	return({seek_string:seek_string,ratiobar:ratiobar});
}

ap_oled.prototype.moode_seek_format = function (seek,duration,song_percent){
	try{
		if(!duration) ratiobar = 0;
		else ratiobar = (song_percent/100) * (this.width - 6) ;
	}
	catch(e){
		ratiobar = 0;
	}	
	try{
		duration = new Date(duration * 1000).toISOString().substr(14, 5);
	}
	catch(e){
		duration = "00:00";
	}
	try{
		seek = new Date(seek * 1000).toISOString().substr(14, 5);
	}
	catch(e){
		seek = "";
	}
	seek_string = seek + " / "+ duration;
	return({seek_string:seek_string,ratiobar:ratiobar});
}

ap_oled.prototype.listen_to = function(api,frequency){
	frequency= frequency || 1000;
	let api_caller = null;
	
	if(api === "volumio"){
        var io = require('socket.io-client');
        var socket = io.connect('http://localhost:3000');
		api_caller = setInterval( 
			()=>{
				if(api_state_waiting) return;
				api_state_waiting = true;
				socket.emit("getState");
			}, frequency );
		let first = true;
		
        socket.emit("getState");
		socket.on("pushState", (data)=> { // se déclenche si changement de morceau / volume / repeat / random / play / pause , ou si l'utilisateur avance manuellement dans la timebar.
			
			let exit_sleep = false;
			if(extn_exit_sleep_mode){
				extn_exit_sleep_mode = false;
				exit_sleep = true;
			}
			if(first){
				first = false;
				socket.emit("getState");
				return;
			}
			api_state_waiting = false;
			
            if( // changement de piste
                this.data.title  !== data.title  || 
                this.data.artist !== data.artist || 
                this.data.album  !== data.album  
            ){
                this.text_to_display = data.title + (data.artist?" - " + data.artist:"") + (data.album?" - " + data.album:"") ;
				this.driver.CacheGlyphsData( this.text_to_display);
				this.text_width = this.driver.getStringWidthUnifont(this.text_to_display + " - ");
				
                this.scroller_x = 0;
                this.refresh_track = REFRESH_TRACK;
				this.footertext = "";
				exit_sleep = true;
            }
			// changement de volume
			if(  this.data.volume !== data.volume ){exit_sleep = true;}
			
			// avance dans la piste
			let seek_data = this.volumio_seek_format( data.seek, data.duration );
			
			if(data.status !== "play" && this.raw_seek_value !== data.seek){
				exit_sleep = true;
			}
			this.raw_seek_value = data.seek;
			
			if(data.status == "play"){exit_sleep = true;}
			
			this.footertext = "";
			if( !data.samplerate && !data.bitdepth && !data.bitrate ) socket.emit("getQueue"); // s'il manque des données, un autre emit permet de compléter les infos pour tout ce qui est fréquence / bitrate
			else{
				if ( data.samplerate ) this.footertext += data.samplerate.replace(/\s/gi,"") + " ";
				if ( data.bitdepth   ) this.footertext += data.bitdepth.replace(/\s/gi,"") + " ";
				if ( data.bitrate    ) this.footertext += data.bitrate.replace(/\s/gi,"") + " ";
			}
			
			this.data = data; // attention à la position de cette commande : une fois cette assignation effectuée, plus aucune comparaison n'est possible avec l'état précédent
			this.data.seek_string = seek_data.seek_string;
			this.data.ratiobar = seek_data.ratiobar;
			this.handle_sleep(exit_sleep);

		});
		
		socket.on("pushQueue", (resdata)=> {
			data = resdata[0];
			if( !this.footertext && data ) {
				if ( data.samplerate ) this.footertext += data.samplerate.replace(/\s/gi,"") + " ";
				if ( data.bitdepth   ) this.footertext += data.bitdepth.replace(/\s/gi,"") + " ";
				if ( data.bitrate    ) this.footertext += data.bitrate.replace(/\s/gi,"") + " ";
			}
		});
		
		return api_caller;
	}
	else if( api === "moode" ){
		var moode_listener = require("./moode_listener.js").moode_listener;
		var moode = new moode_listener();
		moode.on("moode_data", (data)=>{



			let exit_sleep = false;
			if(extn_exit_sleep_mode){
				extn_exit_sleep_mode = false;
				exit_sleep = true;
			}
			
			api_state_waiting = false;
			
            if( // changement de piste
                this.data.title  !== data.title  || 
                this.data.artist !== data.artist || 
                this.data.album  !== data.album  
            ){
				this.text_to_display = data.title + (data.artist?" - " + data.artist:"") + (data.album?" - " + data.album:"");
				this.driver.CacheGlyphsData( this.text_to_display);
				this.text_width = this.driver.getStringWidthUnifont(this.text_to_display + " - ");
				this.scroller_x = 0;
				this.refresh_track = REFRESH_TRACK;
				this.footertext = "";
				exit_sleep = true;
            }
			
			// changement de volume
			if(  this.data.volume !== data.volume ){exit_sleep = true;}
			
			// changement état repeat
			if( this.data.repeat == true && data.repeat == "0" ){ exit_sleep = true;}
			else if( this.data.repeat == false && data.repeat != "0" ){ exit_sleep = true;}
			
			// avance dans la piste
			let seek_data = this.moode_seek_format( data.elapsed, data.time, data.song_percent );
			
			if(data.state !== "play" && this.raw_seek_value !== data.elapsed){
				exit_sleep = true;
			}
			this.raw_seek_value = data.elapsed;
			
			if(data.state == "play"){exit_sleep = true;}
			
			this.footertext = "";

			if (data.audio) 	this.footertext += data.audio + " ";
			if (data.bitrate)	this.footertext += data.bitrate + " ";

			this.data = data; // attention à la position de cette commande : une fois cette assignation effectuée, plus aucune comparaison n'est possible avec l'état précédent
			this.data.seek_string = seek_data.seek_string;
			this.data.ratiobar = seek_data.ratiobar;
			this.handle_sleep(exit_sleep);
			this.data.status = data.state;
			this.data.trackType = data.encoded;
			this.data.repeat = data.repeat !== "0";
		});

		return api_caller;
	}
	else if( api === "ip" ){
		api_caller = setInterval( ()=>{this.get_ip()}, frequency );
		return api_caller;
	}

}

ap_oled.prototype.handle_sleep = function(exit_sleep){
	if( !exit_sleep ){ // Est-ce que l'afficheur devrait passer en mode veille ? 
		if(!this.iddle_timeout){ // vérifie si l'écran n'attend pas déjà de passer en veille (instruction initiée dans un cycle précédent)
			
			let _deepsleep_ = ()=>{this.deep_sleep();}
			let _screensaver_ = ()=>{
				this.snake_screensaver();
				this.iddle_timeout = setTimeout(_deepsleep_,TIME_BEFORE_DEEPSLEEP);
			}
			let _clock_ = ()=>{
				this.clock_mode();
				this.iddle_timeout = setTimeout(_screensaver_,TIME_BEFORE_SCREENSAVER);
			}
			this.iddle_timeout = setTimeout( _clock_ , TIME_BEFORE_CLOCK );
		}
	}
	else{
		this.driver.turnOnDisplay();
		if(this.page !== "spdif" ){
			this.playback_mode();
		}

		if(this.iddle_timeout){
			clearTimeout(this.iddle_timeout);
			this.iddle_timeout = null;
		}
	}
}

ap_oled.prototype.snake_screensaver = function(){
if (this.page === "snake_screensaver") return;
	clearInterval(this.update_interval);
	this.page = "snake_screensaver";
	
	let box_pos = [0,0];
	let count = 0;
	let flip = false;
	let tail = [];
	let tail_max = 25;
	let t_tail_length = 1;
	let random_pickups = [];
	let screen_saver_animation_reset =()=>{
		tail = [];
		count = 0;
		t_tail_length = 10;
		random_pickups = [];
		let nb = 7;
		while(nb--){
			let _x =  Math.floor(Math.random() * (this.width ));
			let _y =  Math.floor(Math.random() * (this.height/3))*3;
			random_pickups.push([_x,_y]);
		}	
	}
	screen_saver_animation_reset();
	this.refresh_action = ()=>{
		this.driver.buffer.fill(0x00);
		let x;
		if( count % this.width == 0) {flip = !flip}
		if(flip) x = count % this.width +1
		else x = this.width - count % this.width
		let y = ~~( count / this.width ) *3
		tail.push([x,y]);
		if(tail.length > t_tail_length ) tail.shift();
		for(let i of tail){
			this.driver.fillRect(i[0],i[1]-1,2,3,1);
		}
		for(let r of random_pickups){
			if(  ( ( flip && x >= r[0] ) || ( !flip && x <= r[0] ) ) && y >= r[1] ){ 
				t_tail_length +=5;
				random_pickups.splice(random_pickups.indexOf(r),1)
			}
			this.driver.fillRect(r[0],r[1],1,1,1);
		}
		count++;
		this.driver.update(true);
		if(y > this.height ) screen_saver_animation_reset();
	}
	this.update_interval = setInterval( ()=>{this.refresh_action()}, 20);
}

ap_oled.prototype.deep_sleep = function(){
if (this.page === "deep_sleep") return;
	clearInterval(this.update_interval);
	this.page = "deep_sleep";
	this.driver.buffer.fill(0x00);
	this.driver.update( ()=>{this.driver.turnOffDisplay();} );
	setTimeout( ()=>{this.driver.update( ()=>{this.driver.turnOffDisplay();} );},10);
}

ap_oled.prototype.clock_mode = function(){
if (this.page === "clock") return;
	clearInterval(this.update_interval);
	this.page = "clock";
	this.refresh_action = ()=>{
		this.driver.buffer.fill(0x00);
		let fdate = date.format(new Date(),'YYYY/MM/DD'),
		ftime = date.format(new Date(),'HH:mm:ss');
		this.driver.setCursor(30, 0);
		this.driver.writeString( fonts.monospace ,1,fdate,1,true, false);
		this.driver.setCursor(16,15);
		this.driver.writeString( fonts.monospace ,2,ftime,1,true,false);
		this.driver.drawLine(1, 34, 127, 34, 1, false);
		this.driver.setCursor(25,40);
		this.driver.writeString(fonts.monospace ,1, (this.ip?this.ip:"No network...") ,1,true,false);
		if(this.data && this.data.volume !== null ){
			let volstring; try{volstring = this.data.volume.toString();} catch(e){volstring = "?";}
			if(this.data.mute === true || volstring === "0") volstring = "X";
			this.driver.setCursor(53,56);
			this.driver.writeString(fonts.icons , 1 , "0" ,1,false,false); 
			this.driver.setCursor(63,56);
			this.driver.writeString(fonts.monospace ,1, volstring ,1,true,false);

		}
		this.driver.update(true);
	}
	this.update_interval = setInterval( ()=>{this.refresh_action()}, 1000);
}

ap_oled.prototype.spdif_mode = function(){
	if (this.page === "spdif") return;
	clearInterval(this.update_interval);
	this.page = "spdif";
	this.refresh_action = ()=>{
		
		this.driver.buffer.fill(0x00);
		
		let fdate = date.format(new Date(),'YYYY/MM/DD'),
		ftime = date.format(new Date(),'HH:mm:ss');
		this.driver.setCursor(35, 0);
		this.driver.writeString( fonts.monospace ,1,ftime,1,true, false);
		
		this.driver.setCursor(16,15);
		this.driver.writeString( fonts.monospace ,2,"SPDIF IN",1,true,false);
		
		this.driver.drawLine(1, 34, 127, 34, 1, false);
		this.driver.setCursor(25,40);
		this.driver.writeString(fonts.monospace ,1, (this.ip?this.ip:"No network...") ,1,true,false);
		if(this.data && this.data.volume !== null ){
			let volstring; try{volstring = this.data.volume.toString();} catch(e){volstring = "?";}
			if(this.data.mute === true || volstring === "0") volstring = "X";
			this.driver.setCursor(53,56);
			this.driver.writeString(fonts.icons , 1 , "0" ,1,false,false); 
			this.driver.setCursor(63,56);
			this.driver.writeString(fonts.monospace ,1, volstring ,1,true,false);

		}
		this.driver.update(true);
	}
	this.update_interval = setInterval( ()=>{this.refresh_action()}, 1000);
	this.refresh_action();
}

ap_oled.prototype.playback_mode = function(){
    
	if (this.page === "playback") return;
	clearInterval(this.update_interval);

 	this.scroller_x = 0;
	this.page = "playback";
    this.text_to_display = this.text_to_display || "";

	this.refresh_action =()=>{
		
        if(this.plotting){ return }; // skip plotting of this frame if the pi has not finished plotting the previous frame
        this.plotting = true;
        this.driver.buffer.fill(0x00);

		if(this.data){
            // volume
            if(this.data.volume !== null ){
               
				let volstring; try{volstring = this.data.volume.toString();} catch(e){volstring = "?";}
                if(this.data.mute === true || volstring === "0") volstring = "X";
                
                this.driver.setCursor(0,0);
                this.driver.writeString(fonts.icons , 1 , "0" ,1,false,false); 
                this.driver.setCursor(10,1);
                this.driver.writeString(fonts.monospace ,1, volstring ,1,true,false);
            }    
			
			// repeat
			if(this.data.repeatSingle){
				this.driver.setCursor(104,0);
				this.driver.writeString(fonts.icons , 1 , "5" ,1,false,false); 
			} else if( this.data.repeat ){
				this.driver.setCursor(104,0);
                this.driver.writeString(fonts.icons , 1 , "4" ,1,false,false); 
            }
			
			// track type (flac, mp3, webradio...etc.)
			if(this.data.trackType){
				this.driver.setCursor(30,1);
				this.driver.writeString(fonts.monospace , 1 , this.data.trackType ,1,false,false); 
			}
		
			// string with any data we have regarding sampling rate and bitrate
			if(this.footertext){
				this.driver.setCursor(0,57);
				this.driver.writeString(fonts.monospace , 1 , this.footertext ,1,false,false); 
			}
			
			// play pause stop logo
			if(this.data.status){
                let status_symbol = "";
				switch(this.data.status){
					case ("play"):
						status_symbol = "1";
						break;
					case ("pause"):
						status_symbol = "2"
						break;		
					case ("stop"):
						status_symbol = "3"
						break;
				}    
                this.driver.setCursor(118,0);
                this.driver.writeString(fonts.icons ,1, status_symbol ,1,true,false);
			}

			// track title album artist
			if(this.text_to_display.length){ 
				//  if the whole text is short enough to fit the whole screen
				if( this.text_width <= this.width ){
					this.driver.setCursor( 0, 17 );
					this.driver.writeStringUnifont(this.text_to_display );  
				}
				else{ // text overflows the display (very likely considering it's 128px) : make the text scroll alongside its horizontal direction
					let text_to_display = this.text_to_display;
					text_to_display = text_to_display + " - " + text_to_display + " - ";
					if(this.scroller_x + (this.text_width) < 0 ){
						this.scroller_x = 0;
					}
					this.driver.cursor_x = this.scroller_x;
					this.driver.cursor_y = 14
					this.driver.writeStringUnifont(text_to_display);
					//this.driver.writeStringUnifont("RadioRadioRadioRadioRadioRadio");
				}
			}
			// seek data
			if(this.data.seek_string){
				let border_right = this.width -3;
				let Y_seekbar = 35;
				let Ymax_seekbar = 38;
				this.driver.drawLine(3, Y_seekbar, border_right , Y_seekbar, 1, false);
				this.driver.drawLine(border_right, Y_seekbar,border_right , Ymax_seekbar, 1, false);
				this.driver.drawLine(3, Ymax_seekbar,border_right, Ymax_seekbar, 1, false);
				this.driver.drawLine(3, Ymax_seekbar, 3, Y_seekbar, 1, false);
				this.driver.cursor_y = 42;
				this.driver.cursor_x = 25;
				this.driver.writeString(fonts.monospace , 1 , this.data.seek_string ,1,false,false); 
				this.driver.fillRect(3, Y_seekbar, this.data.ratiobar, 2, 1);
			}
		}
		
		this.driver.update();
		this.plotting = false;
        if(this.refresh_track) return this.refresh_track--; // ne pas updater le curseur de scroll avant d'avoir écoulé les frames statiques (juste après un changement de morceau)
		this.scroller_x--;
	}
    
	this.update_interval = setInterval( ()=>{ this.refresh_action() },opts.main_rate);
	this.refresh_action();
}

ap_oled.prototype.get_ip = function(){
	try{
		let ips = os.networkInterfaces(), ip = "No network.";
		for(a in ips){
			if( ips[a][0]["address"] !== "127.0.0.1" ){
				ip = ips[a][0]["address"];
				break;
			}
		}
		this.ip = ip;
	}
	catch(e){this.ip = null;}
}

fs.readFile("config.json",(err,data)=>{
	
	if(err) console.log("Cannot read config file. Using default settings instead.");
	else{
		try { 
			data = JSON.parse( data.toString() );
			TIME_BEFORE_SCREENSAVER = (data && data.sleep_after) ? data.sleep_after  * 1000 : TIME_BEFORE_SCREENSAVER
			TIME_BEFORE_DEEPSLEEP = (data && data.deep_sleep_after) ? data.deep_sleep_after  * 1000 : TIME_BEFORE_DEEPSLEEP
			CONTRAST = (data && data.contrast) ? data.contrast : CONTRAST
		} catch(e){
			console.log("Cannot read config file. Using default settings instead.");
		}
	}
	
	const OLED = new ap_oled(opts);
	var logo_start_display_time = 0;
	
	OLED.driver.begin(
		()=>{
			OLED.driver.turnOnDisplay();
			DRIVER = OLED;
			OLED.driver.setContrast(CONTRAST);
			
			OLED.driver.load_and_display_logo( (displaylogo)=>{ 
				if(displaylogo) logo_start_display_time = new Date();
			});
			OLED.driver.load_hex_font("unifont.hex", start_app);
		}
	);

	function start_app(){
		// check if logo has had enough time to display
		let time_remaining = 0;
		if(logo_start_display_time){
			time_remaining = LOGO_DURATION - ( new Date().getTime() - logo_start_display_time.getTime() )  ;
			time_remaining = (time_remaining<=0)?0:time_remaining;
		}
		setTimeout( ()=>{
			OLED.playback_mode();
			var volumio_poller = OLED.listen_to( distro,1000 );
			var network_poller = OLED.listen_to( "ip",  1000 );
		}, time_remaining )
	}

	function exitcatcher(options) {
		if (options.cleanup) OLED.driver.turnOffDisplay();
		if (options.exit) process.exit();
	}

	process.on('exit', exitcatcher.bind(null,{cleanup:true}));
	process.on('SIGINT', exitcatcher.bind(null, {exit:true}));
	process.on('SIGUSR1', exitcatcher.bind(null, {exit:true}));
	process.on('SIGUSR2', exitcatcher.bind(null, {exit:true}));
	//process.on('uncaughtException', exitcatcher.bind(null, {exit:true}));


	
});

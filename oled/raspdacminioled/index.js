const fs = require("fs");

const DRIVER =  require("ssd1306").driver;
const SSD1306 = new DRIVER();
const GRAPHICS =  new ( require("lightbwgraphics") ).GRAPHICS().attachDriver(SSD1306);

const os = require("os");
const date = require('date-and-time');
const http = require("http");




var TIME_BEFORE_CLOCK = 6000; // in ms
var TIME_BEFORE_SCREENSAVER = 120000; // in ms
var TIME_BEFORE_DEEPSLEEP = 160000; // in ms
var LOGO_DURATION = 4000; // in ms
var CONTRAST = 80; // range 1-254

var FAST_REFRESH_RATE = 40;
const REFRESH_TRACK = 80;
var api_state_waiting = false; 


const distro = process.argv[2],
supported_distributions = ["volumio","moode","lms"];
if(!distro || !supported_distributions.includes(distro) ){
	console.warn("Unknown target distribution : ",distro, "\nHere are the supported distributions : ", supported_distributions.join() );
}

function ap_oled(){
	this.scroller_x = 0;
	this.streamerData = {};
	this.ip = null;
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
	this._exitsleepmode = false;

}


ap_oled.prototype._initHTTP = function(port){
	
	port = port || 4153;
	
	let server =(req,res)=>{
		let cmd = req.url.split("\/")[1];
		value = cmd.split("=");
		cmd = value[0];
		value = value[1];
		
		this._exitsleepmode = true;
		
		switch(cmd){
			case 'restart':
				process.exit(0);
				break;
			case 'contrast':
				if(value < 255 && value >= 0 ){
					GRAPHICS.setContrast(value);
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
				if(value === "SPDIF"){this.spdif_mode();}
				else this.playback_mode();
				break;
		}
		res.end("1");		
	}

	this._HTTPSERVER = http.createServer(server).listen(port);
	
}



ap_oled.prototype.volumio_seek_format = function (seek,duration){
	try{
		if(!duration) ratiobar = 0;
		else ratiobar =  ( seek / (duration * 1000) * (GRAPHICS.WIDTH - 6) );
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
		else ratiobar = (song_percent/100) * (GRAPHICS.WIDTH - 6) ;
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

function pad_zero(n){
    if(!n) return("00");
    n = n.toString(); 
    (n.toString().length === 1) && (n = "0"+n);
    return n;
}

ap_oled.prototype.lms_seek_format = function (seek,duration){
    let s_string =  pad_zero(parseInt(seek/60)) + ":" + pad_zero(parseInt(seek%60)),
        d_string =  pad_zero(parseInt(duration/60)) + ":" + pad_zero(parseInt(duration%60)),
		seek_string = s_string + " / " + d_string,
		ratiobar = (seek != 0 && duration != 0) ? ( seek / duration * (GRAPHICS.WIDTH - 6) ):0;
	this.data.seek_string = seek_string;
	this.data.ratiobar = parseInt(ratiobar);
}

ap_oled.prototype.get_mac_squeeze = function(mac_range){
	let macs = os.networkInterfaces(),k = Object.keys(macs),  mac = null;
	try{
		for(a of k){
			if( mac_range.includes(macs[a][0]["mac"] ) ){
				mac = macs[a][0]["mac"];
				break;
			}
		}
	}
	catch(e){}
	this.mac = mac;
	return this.mac;
}




ap_oled.prototype.listen_to = function(api,frequency){
	frequency= frequency || 1000;
	let api_caller = null;
	
	if(api === "volumio"){
        let io = require('socket.io-client');
        let socket = io.connect('http://localhost:3000', {reconnectionDelayMax: 5000,});
		api_caller = setInterval( 
			()=>{
				if(api_state_waiting) return;
				api_state_waiting = true;
				socket.emit("getState");
			}, frequency );
		let first = true;
		
		socket.on("connect_error", (e)=>{
			console.log("Cannot connect to volumio")
			this.streamer_not_found_mode(api);
		})
		
        socket.emit("getState");
		socket.on("pushState", (data)=> { // se déclenche si changement de morceau / volume / repeat / random / play / pause , ou si l'utilisateur avance manuellement dans la timebar.
			
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
				GRAPHICS.CacheGlyphsData( this.text_to_display);
				this.text_width = GRAPHICS.getStringWidthUnifont(this.text_to_display + " - ");
				
                this.scroller_x = 0;
                this.refresh_track = REFRESH_TRACK;
				this.footertext = "";
				this._exitsleepmode = true;
            }
			// changement de volume
			if(  this.data.volume !== data.volume ){this._exitsleepmode = true;}
			
			// avance dans la piste
			let seek_data = this.volumio_seek_format( data.seek, data.duration );
			
			if(data.status !== "play" && this.raw_seek_value !== data.seek){
				this._exitsleepmode = true;
			}
			this.raw_seek_value = data.seek;
			
			if(data.status == "play"){this._exitsleepmode = true;}
			
			this.footertext = "";
			if( !data.samplerate && !data.bitdepth && !data.bitrate ) socket.emit("getQueue"); // s'il manque des données, un autre emit permet de compléter les infos pour tout ce qui est fréquence / bitrate
			else{
				if ( data.samplerate ) this.footertext += data.samplerate.toString().replace(/\s/gi,"") + " ";
				if ( data.bitdepth   ) this.footertext += data.bitdepth.toString().replace(/\s/gi,"") + " ";
				if ( data.bitrate    ) this.footertext += data.bitrate.toString().replace(/\s/gi,"") + " ";
			}
			
			this.data = data; // attention à la position de cette commande : une fois cette assignation effectuée, plus aucune comparaison n'est possible avec l'état précédent
			this.data.seek_string = seek_data.seek_string;
			this.data.ratiobar = seek_data.ratiobar;
			this.handle_sleep();

		});
		
		socket.on("pushQueue", (resdata)=> {
			data = resdata[0];
			if( !this.footertext && data ) {
				if ( data.samplerate ) this.footertext += data.samplerate.toString().replace(/\s/gi,"") + " ";
				if ( data.bitdepth   ) this.footertext += data.bitdepth.toString().replace(/\s/gi,"") + " ";
				if ( data.bitrate    ) this.footertext += data.bitrate.toString().replace(/\s/gi,"") + " ";
			}
		});
		
		return api_caller;
	}
	else if( api === "moode" ){
		var moode_listener = require("moodelistener").moode_listener;
		var moode = new moode_listener();
		
		moode.on("not_found", ()=>{
			this.streamer_not_found_mode(api);
		});
		
		moode.on("moode_data", (data)=>{


			api_state_waiting = false;
			
            if( // changement de piste
                this.data.title  !== data.title  || 
                this.data.artist !== data.artist || 
                this.data.album  !== data.album  
            ){
				this.text_to_display = data.title + (data.artist?" - " + data.artist:"") + (data.album?" - " + data.album:"");
				GRAPHICS.CacheGlyphsData( this.text_to_display);
				this.text_width = GRAPHICS.getStringWidthUnifont(this.text_to_display + " - ");
				this.scroller_x = 0;
				this.refresh_track = REFRESH_TRACK;
				this.footertext = "";
				this._exitsleepmode = true;
            }
			
			// changement de volume
			if(  this.data.volume !== data.volume ){this._exitsleepmode = true;}
			
			// changement état repeat
			if( this.data.repeat == true && data.repeat == "0" ){ this._exitsleepmode = true;}
			else if( this.data.repeat == false && data.repeat != "0" ){ this._exitsleepmode = true;}
			
			// avance dans la piste
			let seek_data = this.moode_seek_format( data.elapsed, data.time, data.song_percent );
			
			if(data.state !== "play" && this.raw_seek_value !== data.elapsed){
				this._exitsleepmode = true;
			}
			this.raw_seek_value = data.elapsed;
			
			if(data.state == "play"){this._exitsleepmode = true;}
			
			this.footertext = "";

			if (data.audio) 	this.footertext += data.audio + " ";
			if (data.bitrate)	this.footertext += data.bitrate + " ";

			this.data = data; // attention à la position de cette commande : une fois cette assignation effectuée, plus aucune comparaison n'est possible avec l'état précédent
			this.data.seek_string = seek_data.seek_string;
			this.data.ratiobar = seek_data.ratiobar;
			this.handle_sleep();
			this.data.status = data.state;
			this.data.trackType = data.encoded;
			this.data.repeat = data.repeat !== "0";
		});

		return api_caller;
	}
	else if( api === "lms" ){
			
		const LMS = require('logitechmediaserver'),
		lms = new LMS('127.0.0.1',9090); // se connecter au serveur LMS local
		
		lms.on("registration_finished", ()=>{
			console.log("[EVO DISPLAY#2] : LMS monitoring OK.");
			let players = Object.keys(lms.players);
			
			this.get_mac_squeeze(players); // trouver la platine squeezelite qui tourne en local sur la même machine
			
			
			if(!this.mac){
				console.log("[EVO DISPLAY#2] : Squeezelite is not running or is not connected to this LMS server... Nothing will happen");
			}
			else{
				console.log("[EVO DISPLAY#2] : Squeezelite is running on "+this.mac)
			}
			this.lms_player = lms.players[this.mac];
			
			this.lms_player.on("time", (t)=> {
				let exit_sleep = false;
				if( this.data.seek !== t ){
					this.data.seek = t;
					this.lms_seek_format(this.data.seek, this.data.duration);
					exit_sleep = true;
				}
				this.handle_sleep(exit_sleep);
			});	
						
			this.lms_player.on("volume", (v)=> {
				let exit_sleep = false;
				if(v && this.data.volume != v ){
					this.data.volume = this.lms_player["volume"];
					exit_sleep = true;
				}
				this.handle_sleep(exit_sleep);
			});
			
			this.lms_player.on("status_change", (s)=> {
				let data  = {}, exit_sleep = false;
				for(p of s){ data[p] = this.lms_player[p];}
				// je ne sais pas pourquoi il y a trois variables différentes pour représenter le titre du morceau 
				// mais on fait en sorte de n'en garder qu'une seule pour l'écran
				if( !data['title'] && data["current_title"] ){
					data['title'] = data["current_title"];
				}
				if(data["remote"] && data["remote"] === "1"){ data.title = (data.title?data.title:"") + ((data.title && data.remote_title)?" - ":"") + (data.remote_title?data.remote_title:""); }
				else{ data.remote_title && delete data.remote_title;}
				
				// détecter changement de piste
				if(	
					(data.title 
					|| data.artist                                                                                                                                                                                                                                                     
					|| data.album) 
					&& 
					(  
						(data.title  && this.data.title  !== data.title )  
					||	(data.artist && this.data.artist !== data.artist		 )
					||	(data.album  && this.data.album  !== data.album		 )
					)
				){	
					// formattage du titre et mise en cache des caractères requis pour le représenter.
					this.text_to_display = data.title + (data.artist?" - " + data.artist:"") + (data.album?" - " + data.album:"");
					GRAPHICS.CacheGlyphsData( this.text_to_display);
					this.text_width = GRAPHICS.getStringWidthUnifont(this.text_to_display + " - ");
					// rembobinage du scroller horizontal
					this.scroller_x = 0;
					this.refresh_track = REFRESH_TRACK;
					// si c'est une radio, le changement de piste est automatique 
					// alors cet event ne doit pas sortir l'écran de veille
					if( !data["remote"] ){
						exit_sleep = true; 
					}
				}
				
				this.footertext = "";
				data.samplerate && data.samplerate!= "0" &&( this.footertext += data.samplerate.toString().replace(/\s.*?$/,"") )
				data.bitrate && data.bitrate!= "0" && ( this.footertext += " "+data.bitrate.toString().replace(/\s.*?$/,"") )
				
				// repeat 
				
				let current_repeat_status = (this.data.repeatSingle)?2:(this.data.repeat?1:0);
				if( current_repeat_status != data['playlist repeat']  ){
					exit_sleep = true;
					switch(data['playlist repeat']){
						case('0'):
							this.data.repeat = null;
							this.data.repeatSingle = null;
							break;
						case('1'):
							this.data.repeat = null;
							this.data.repeatSingle = true;
							break;
						case('2'):
							this.data.repeat = true;
							this.data.repeatSingle = null;
							break;
					}
				}
				
				if(this.data.status == "play") exit_sleep = true; // quoiqu'il se passe côté lecteur, pas de mise en veille si status == play
				// Mettre à jour donnéees lecteur pour future comparaison
				for(d of Object.keys(data)){ this.data[d] = data[d];}
				this.handle_sleep(exit_sleep);
				
			});
			
			this.lms_player.on("mode", (s)=> {
				if(s == "play"){exit_sleep = true;}
				this.data.status = s;
			});
				
		});
		
		lms.on("lms_not_found", ()=>{
			console.log("lms not found !")
			this.streamer_not_found_mode(api);
		});
		
		console.log("[EVO DISPLAY#2] : starting LMS monitoring");	
		lms.start();

	}
		
	
	else if( api === "ip" ){
		api_caller = setInterval( ()=>{this.get_ip()}, frequency );
		return api_caller;
	}

}

ap_oled.prototype.handle_sleep = function(){
	if( !this._exitsleepmode ){ // Est-ce que l'afficheur devrait passer en mode veille ? 
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
		GRAPHICS.turnOnDisplay();
		if(this.page !== "spdif" ){
			this.playback_mode();
		}

		if(this.iddle_timeout){
			clearTimeout(this.iddle_timeout);
			this.iddle_timeout = null;
		}
	}
	
	this._exitsleepmode = false;
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
			let _x =  Math.floor(Math.random() * (GRAPHICS.WIDTH ));
			let _y =  Math.floor(Math.random() * (GRAPHICS.HEIGHT/3))*3;
			random_pickups.push([_x,_y]);
		}	
	}
	screen_saver_animation_reset();
	this.refresh_action = ()=>{
		GRAPHICS.buffer.fill(0x00);
		let x;
		if( count % GRAPHICS.WIDTH == 0) {flip = !flip}
		if(flip) x = count % GRAPHICS.WIDTH +1
		else x = GRAPHICS.WIDTH - count % GRAPHICS.WIDTH
		let y = ~~( count / GRAPHICS.WIDTH) *3
		tail.push([x,y]);
		if(tail.length > t_tail_length ) tail.shift();
		for(let i of tail){
			GRAPHICS.fillRect(i[0],i[1]-1,2,3,1);
		}
		for(let r of random_pickups){
			if(  ( ( flip && x >= r[0] ) || ( !flip && x <= r[0] ) ) && y >= r[1] ){ 
				t_tail_length +=5;
				random_pickups.splice(random_pickups.indexOf(r),1)
			}
			GRAPHICS.fillRect(r[0],r[1],1,1,1);
		}
		count++;
		GRAPHICS.update(true);
		if(y > GRAPHICS.HEIGHT ) screen_saver_animation_reset();
	}
	this.update_interval = setInterval( ()=>{this.refresh_action()}, 20);
}

ap_oled.prototype.deep_sleep = function(){
if (this.page === "deep_sleep") return;
	clearInterval(this.update_interval);
	this.page = "deep_sleep";
	GRAPHICS.buffer.fill(0x00);
	GRAPHICS.update( ()=>{GRAPHICS.turnOffDisplay();} );
	setTimeout( ()=>{GRAPHICS.update( ()=>{GRAPHICS.turnOffDisplay();} );},10);
}

ap_oled.prototype.clock_mode = function(){
if (this.page === "clock") return;
	clearInterval(this.update_interval);
	this.page = "clock";
	this.refresh_action = ()=>{
		GRAPHICS.buffer.fill(0x00);
		let fdate = date.format(new Date(),'YYYY/MM/DD'),
		ftime = date.format(new Date(),'HH:mm:ss');
		
		GRAPHICS.setCursor(30, 0);
		GRAPHICS.writeString( "monospace" ,1,fdate);
		GRAPHICS.setCursor(16,15);
		GRAPHICS.writeString( "monospace" ,2,ftime);
		GRAPHICS.drawLine(1, 34, 127, 34);
		
		GRAPHICS.setCursor(25,40);
		GRAPHICS.writeString("monospace" ,1, (this.ip?this.ip:"No network...") );
		if(this.data && this.data.volume !== null ){
			let volstring; try{volstring = this.data.volume.toString();} catch(e){volstring = "?";}
			if(this.data.mute === true || volstring === "0") volstring = "X";
			GRAPHICS.setCursor(53,56);
			GRAPHICS.writeString("icons" , 1 , "0"); 
			GRAPHICS.setCursor(63,56);
			GRAPHICS.writeString("monospace" ,1, volstring );

		}
		GRAPHICS.update(true);
	}
	this.update_interval = setInterval( ()=>{this.refresh_action()}, 1000);
	this.refresh_action();
}

ap_oled.prototype.spdif_mode = function(){
	if (this.page === "spdif") return;
	clearInterval(this.update_interval);
	this.page = "spdif";
	this.refresh_action = ()=>{
		
		GRAPHICS.buffer.fill(0x00);
		
		let fdate = date.format(new Date(),'YYYY/MM/DD'),
		ftime = date.format(new Date(),'HH:mm:ss');
		GRAPHICS.setCursor(35, 0);
		GRAPHICS.writeString( "monospace" ,1,ftime,1,true, false);
		
		GRAPHICS.setCursor(16,15);
		GRAPHICS.writeString( "monospace" ,2,"SPDIF IN",1,true,false);
		
		GRAPHICS.drawLine(1, 34, 127, 34, 1, false);
		GRAPHICS.setCursor(25,40);
		GRAPHICS.writeString("monospace" ,1, (this.ip?this.ip:"No network...") ,1,true,false);
		if(this.data && this.data.volume !== null ){
			let volstring; try{volstring = this.data.volume.toString();} catch(e){volstring = "?";}
			if(this.data.mute === true || volstring === "0") volstring = "X";
			GRAPHICS.setCursor(53,56);
			GRAPHICS.writeString("icons" , 1 , "0" ,1,false,false); 
			GRAPHICS.setCursor(63,56);
			GRAPHICS.writeString("monospace" ,1, volstring ,1,true,false);

		}
		GRAPHICS.update(true);
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
		
        if(this.plotting) return ; // ignorer le calcul de cette frame si la frame précédente est toujours en cours de calcul

        this.plotting = true;
        GRAPHICS.buffer.fill(0x00);
		
		if(this.data){
			
            // volume
            if(this.data.volume !== null ){
               
				let volstring; try{volstring = this.data.volume.toString();} catch(e){volstring = "?";}
                if(this.data.mute === true || volstring === "0") volstring = "X";
                GRAPHICS.setCursor(0,0);
                GRAPHICS.writeString("icons" , 1 , "0" ); 
                GRAPHICS.setCursor(10,1);
                GRAPHICS.writeString("monospace" ,1, volstring );
            }    
			
			// mode repeat
			if(this.data.repeatSingle){
				GRAPHICS.setCursor(104,0);
				GRAPHICS.writeString("icons" , 1 , "5" ,1,false,false); 
			} else if( this.data.repeat ){
				GRAPHICS.setCursor(104,0);
                GRAPHICS.writeString("icons" , 1 , "4" ,1,false,false); 
            }
			
			// type de piste (flac, mp3, webradio...etc.)
			if(this.data.trackType){
				GRAPHICS.setCursor(30,1);
				GRAPHICS.writeString("monospace" , 1 , this.data.trackType ,1,false,false); 
			}
		
			// string contenant toutes data concernant sampling rate & bitrate
			if(this.footertext){
				GRAPHICS.setCursor(0,57);
				GRAPHICS.writeString("monospace" , 1 , this.footertext ,1,false,false); 
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
                GRAPHICS.setCursor(118,0);
                GRAPHICS.writeString("icons" ,1, status_symbol ,1,true,false);
			}

			// track title album artist
			if(this.text_to_display.length){ 
				//  est-ce que le texte est assez court pour tenir dans toute la largeur de l'écran ? 
				if( this.text_width <= GRAPHICS.WIDTH ){
					GRAPHICS.setCursor( 0, 17 );
					GRAPHICS.writeStringUnifont(this.text_to_display );  
				}		
				else{ // si le texte dépasse de la largeur de l'écran (très probable puisqu'il fait 128px) : faire scroller le texte horizontalement
					let text_to_display = this.text_to_display;
					text_to_display = text_to_display + " - " + text_to_display + " - ";
					if(this.scroller_x + (this.text_width) < 0 ){
						this.scroller_x = 0;
					}
					GRAPHICS.cursor_x = this.scroller_x;
					GRAPHICS.cursor_y = 14
					GRAPHICS.writeStringUnifont(text_to_display);
				}
			}
			
			// seek data
			if(this.data.seek_string){
				let border_right = GRAPHICS.WIDTH -3;
				let Y_seekbar = 35;
				let Ymax_seekbar = 38;
				GRAPHICS.drawLine(3, Y_seekbar, border_right , Y_seekbar, 1, false);
				GRAPHICS.drawLine(border_right, Y_seekbar,border_right , Ymax_seekbar, 1, false);
				GRAPHICS.drawLine(3, Ymax_seekbar,border_right, Ymax_seekbar, 1, false);
				GRAPHICS.drawLine(3, Ymax_seekbar, 3, Y_seekbar, 1, false);
				GRAPHICS.cursor_y = 42;
				GRAPHICS.cursor_x = 25;
				GRAPHICS.writeString("monospace" , 1 , this.data.seek_string ,1,false,false); 
				GRAPHICS.fillRect(3, Y_seekbar, this.data.ratiobar, 2, 1);
			}
		}
		
		GRAPHICS.update();
		this.plotting = false;

        if(this.refresh_track) return this.refresh_track--; // ne pas updater le curseur de scroll avant d'avoir écoulé les frames statiques (juste après un changement de morceau)
		this.scroller_x--;
	}
    
	this.update_interval = setInterval( ()=>{ this.refresh_action() },FAST_REFRESH_RATE);
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

ap_oled.prototype.streamer_not_found_mode = function(api){
if (this.page === "streamer_not_found") return;
	clearInterval(this.update_interval);
	this.page = "streamer_not_found";
	let timer = 5;
	this.refresh_action = ()=>{
		
		GRAPHICS.buffer.fill(0x00);
		
		GRAPHICS.setCursor(14, 10);
		GRAPHICS.writeString( "monospace" ,1,api +" not found",3);
		
		GRAPHICS.setCursor(14, 25);
		GRAPHICS.writeString( "monospace" ,1,"Retrying in... "+timer,3);
		
		GRAPHICS.update(true);
		timer--;
		if(timer<0) timer = 5;
		
	}
	this.refresh_action();
	this.update_interval = setInterval( ()=>{this.refresh_action()}, 1000);
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
	
	//const OLED = new ap_oled(opts);
	let logo_start_display_time = 0;
	GRAPHICS.load_and_display_logo( (displaylogo)=>{ if(displaylogo) logo_start_display_time = new Date(); });
	
	GRAPHICS.load_hex_font("unifont.hex", ()=>{ 
		
		let OLED = new ap_oled();
		OLED._initHTTP();
		
		let time_remaining = 0; // est-ce que le logo a eu assez de temps d'affichage ? 
		if(logo_start_display_time){
			time_remaining = LOGO_DURATION - ( new Date().getTime() - logo_start_display_time.getTime() )  ;
			time_remaining = (time_remaining<=0)?0:time_remaining;
		}
		
		setTimeout( ()=>{
			OLED.playback_mode();
			var streamer_poller = OLED.listen_to( distro,1000 );
			var network_poller = OLED.listen_to( "ip",  1000 );
		}, time_remaining )
		
		process.on('SIGINT', ()=>{
			GRAPHICS.turnOffDisplay();
			process.exit();
		});
	
	});





});





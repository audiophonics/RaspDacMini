const cp = require("child_process");
const fs = require("fs");
const net = require("net");
const oled_path = process.cwd() + "/../oled";
var module_alert = "";
var config = {};
read_config();

exports.module_head = `<div class="content_name">
                <h2>Screen</h2>
                <p>To configure your RaspDac Mini Oled display !</p>
            </div>`


exports.make_html = make_html;
function make_html(){
    return `
    ${module_alert}
    
    <div class="display_settings">
    	<div class="oled_wrap">
	    	<div class="oled_settings">
			    <form id ="contrast" action="/" method="post"> 
			        <label for="value">Contrast :</label>
			        <input type = "number" max="254" min="1" placeholder="1 - 254" name="value" value=${config.contrast} >
			        <button type="submit">Set</button><br>
			        <input type = "hidden" name="target_module" value="${module.exports.title}" >
			        <input type = "hidden" name="target_command" value="update_config" >
			        <input type = "hidden" name="config_key" value="contrast" >
			        <input type = "hidden" name="curl_rt" value="1" >
			    </form>

			    <form id ="sleep_after" action="/" method="post"> 
			        <label for="value">Delay (screen saver) :</label>
			        <input type = "number" min="1" placeholder="in seconds" name="value" value=${config.sleep_after} >
			        <button type="submit">Set</button><br>
			        <input type = "hidden" name="target_module" value="${module.exports.title}" >
			        <input type = "hidden" name="target_command" value="update_config" >
			        <input type = "hidden" name="config_key" value="sleep_after" >
					<input type = "hidden" name="curl_rt" value="1" >
			    </form>
			    <form id ="deep_sleep" action="/" method="post"> 
			        <label for="value">Delay (deep sleep) :</label>
			        <input type = "number" min="1" placeholder="in seconds" name="value" value=${config.deep_sleep_after} >
			        <button type="submit">Set</button><br>
			        <input type = "hidden" name="target_module" value="${module.exports.title}" >
			        <input type = "hidden" name="target_command" value="update_config" >
			        <input type = "hidden" name="config_key" value="deep_sleep_after" >
					<input type = "hidden" name="curl_rt" value="1" >
			    </form>
			</div>
			<div class="oled_restart">    
			    <form id ="restart_oled" action="/" method="post"> 
			        <button type="submit" class="ok_btn">Restart OLED</button><br>
			        <input type = "hidden" name="target_module" value="${module.exports.title}" >
			        <input type = "hidden" name="target_command" value="restart_oled" >
			    </form>
			</div>
		</div>
		
	    
	    <div class="logo_settings">
		    <h3>Logo</h3>
			<canvas id="canvas" style="border:solid 1px black"></canvas>
			<div class="logo_parameters">	
				<div class="logo_size">
					<div class="logo_setting display_width">
						<label for="screenwidth">Display width :</label>
				        <input name ="screenwidth" id = "screenwidth" type="number" value="128" placeholder = "in pixel"> <br>
					</div>
					<div class="logo_setting display_height">
						<label for="screenheight">Display height :</label>
				        <input name ="screenheight" id="screenheight" type="number" value="64" placeholder = "in pixel"> <br>
					</div>
					<div class="logo_setting raster_tolerance">
						<label for="tolerance">Raster Tolerance :</label>
				        <input name="tolerance" id="tolerance" type="number" max="100" min="1" title = "if source is not pixel perfect" placeholder = "in %" value = 50>	<br>
					</div>
				</div>

				<div class="logo_setting image_upload">
					<label for="filesource">Image source (file) :</label>
			        <input name="filesource" id = "filesource" type="file">
				</div>
			</div>
			
			<div class="submit_button">
				<button id = "restore" class="alt_btn">Default logo</button>
				<button id = "savebtn" class="ok_btn">Save</button>
			</div>
		</div>
	</div>
		    
    
    
    <script>
    

    
    (function(){
            var ratio = 1;
			var pixel_perfect = false;
			
			var	w = document.getElementById('screenwidth');
			var	h = document.getElementById('screenheight');
			var tolerance = document.getElementById('tolerance');
			var canvas = document.getElementById("canvas");
			canvas.height = h.value;
			canvas.width = w.value;
			var ctx = canvas.getContext('2d');
			//Loading of the home test image - img1

			var input = document.getElementById('filesource');
			input.onchange = blob_to_pic
			
			var savebtn = document.getElementById('savebtn');
			savebtn.onclick = save
			
			screenwidth = document.getElementById("screenwidth")
			
			
			function blob_to_pic() {
				renderblob(input.files[0],preview);
			}

			var renderblob = function(blob,callback){
			  let img = new Image();
			  img.onload = function(){
			    ratio = (screenwidth.value/img.width)
				if(ratio === 1){
					console.log("Pixel Perfect")
					pixel_perfect = true
				}else{
					pixel_perfect = false;
					console.log("Result is not pixel perfect")
				}
				canvas.width = img.width * ratio
				canvas.height = img.height * ratio
				
				ctx.drawImage(img, 0, 0,img.width * ratio,img.height * ratio  )
				if(typeof callback === "function"){
					callback();
				}
			  }

			  img.src = URL.createObjectURL(blob);
			};
						
			
			function map_pixels(){

				imgdata = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
				let i = 0;
				data = [];
				values = [];
				
				let z = imgdata.length;
				while(i<z){
					val = Math.min(imgdata[i],imgdata[i+1],imgdata[i+2],imgdata[i+3]);
					if(!values.includes(val)){
						values.push(val);
					}
					data.push(val);
					i+=4;
				}
					
				return(data)
			}
			
			function preview(){
				console.log("preview")
				if(!h.value || !w.value){
					alert("display needs height and width")
					return
				}		

				if(!pixel_perfect && !tolerance.value){
					alert("% tolerance must be specified if input image is not pixel perfect")
					return
				}

				b = map_pixels()
				canvas.height = h.value
				canvas.width = w.value
				s = 0;
				t= (tolerance.value/100)*255
				for(let i in b){
					x = s%canvas.width
					y = Math.floor(s/canvas.width) 
					s++;
					if(b[i] < t){
						ctx.fillStyle = "black"
						ctx.fillRect(x,y,1,1)
					}
				}
			}
			
			function save(){
				imgdata = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
				let z = imgdata.length
							let i = 0
							data = [];
							values = [];
							while(i<z){
								val = Math.max(imgdata[i],imgdata[i+1],imgdata[i+2],imgdata[i+3])
								if(!values.includes(val)){
									values.push(val)
								}
								data.push(val)
								i+=4
							}
				if(values.length > 2){
					alert("Something went wrong")}
				else{
					upload(compress(data))
				}
			}
            
            function upload(data){
                let xhp = new XMLHttpRequest();
               
                xhp.onload = function(){
                   alert(xhp.responseText);
                }
                xhp.open("POST","");
                xhp.send(JSON.stringify({
                    target_module:"${module.exports.title}", 
                    target_command:"change_logo",
                    response_type:"JSON",
                    logo : data
                })); 
            }
            
			function compress(data){
				let compressed = ""
				let counter = 0;
				let previous_data = 0;
				let l = data.length
				let i = 0;
				while(i <= l){

					if(previous_data !== data[i] ||  i === l ){
						compressed+=(counter+"\\n")
						counter = 1;
					}
					else{
						counter++;
					}
					previous_data = data[i]
					i++;
					
				}
				return(compressed)
			}     


		tolerance.onchange = h.onchange = w.onchange = ()=>{
			renderblob(input.files[0],()=>{
				preview()
			});
		}

		restore.onclick = ()=>{
            let xhp = new XMLHttpRequest();
            xhp.onload = function(){
               alert(xhp.responseText);
            }
            xhp.open("POST","");
            xhp.send(JSON.stringify({
                target_module:"${module.exports.title}", 
                target_command:"default_logo",
                response_type:"JSON"
            })); 
		}
			
    })()
    </script>
`
}

exports.update_config = function(data,callback){   
    if (!data || !data.config_key || !data.value ) return callback ("Error : invalid config change " + JSON.stringify(data) );
    let tempNewConfig = JSON.parse(JSON.stringify(config));
    tempNewConfig[data.config_key] = data.value;
    writeConfig(tempNewConfig,callback);
	if(!data.curl_rt) cp.exec("sudo systemctl restart oled");
	else{
		 cp.exec(`curl "localhost:4153/${data.config_key}=${data.value}"`);
	}
}

exports.restart_oled = function(data,callback){ cp.exec("sudo systemctl restart oled",
	function(err,data){
		if(err) return callback("Cannot access systemctl :" + err );
		return callback("Restarting : OK");
	}
);}

exports.change_logo = function(data,callback){
    let newlogo = data.logo;
    if(typeof newlogo !=="string") return callback("change_logo : No value / invalid value received")
    fs.writeFile('./../oled/logo.logo', newlogo, (err) => {
        if (err) callback(err);
        else callback("logo updated");
    });
}

exports.default_logo = function(data,callback){
  fs.readFile("./../oled/default_logo.logo", (err, contents) => {
    if (err) return callback(err);
    fs.writeFile("./../oled/logo.logo", contents, (err)=>{
        if (err) callback(err);
        else callback("logo updated");
    });
  });
}

// helpers --------------------------------

function uds_proxy(message,callback){

    if(typeof message !== "string"){
        try{message = JSON.stringify(message)}
        catch(e){ return console.log("Error in uds: expected data type : JSON, got",message)}
    }
    
    let socket = net.Socket();
    socket.connect(oled_path+"/input_for_display");
    socket.on('connect', function() {
        socket.write(message);
        socket.destroy();
        if(typeof callback ==="function") callback("Restart : OK");
    });

    socket.on('error', function(err){
        if(typeof callback ==="function") callback(JSON.stringify(arguments));
        console.log("UDS Error : "+JSON.stringify(arguments));
    });   
}


function read_config(){
   fs.readFile(oled_path+"/config.json",parse_contrast);
   function parse_contrast(err,data){
       if(err) return module_alert += ("Error : cannot read config.json which should be located at " + oled_path, "detail :", err);
            try{config = JSON.parse(data)}
            catch(e){module_alert += "Error : " + oled_path + "/config.json is corrupted",  "detail :", e}
   }
}

function writeConfig(newconfig,callback){

    // verify data compliance with original file (keys can be updated but not removed)
    let oldConfigKeys = Object.keys(config).sort();
    let newConfigKeys = Object.keys(newconfig).sort();
    if ( ! JSON.stringify(oldConfigKeys) === JSON.stringify(newConfigKeys) ){
        return callback("Error : value does not comply with config.json structure (" +oled_path+"). Received data is : "+JSON.stringify(data)+"against "+ JSON.stringify(config) );
    }
    
    // write to file
    fs.writeFile(oled_path+"/config.json",JSON.stringify(newconfig),(err,data)=>{
        if(err) return callback("Error writing to configuration file : " + err)
        config = newconfig;
        callback("Configuration has been saved");
       
        
    });    
}




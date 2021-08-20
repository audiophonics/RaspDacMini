const cp = require("child_process");
const fs = require("fs");
const net = require("net");
const oled_path = process.cwd() + "/../oled";
var module_alert = "";
var input = "";
var filter = "";
read_config();

exports.module_head = `<div class="content_name">
                <h2>DAC</h2>
                <p>To configure your RaspDac Mini Oled DAC !</p>
            </div>`


exports.make_html = make_html;
function make_html(){
    return `
    ${module_alert}
    
    <div class="dac_settings">
	
    	<div class="dac_wrap">
		
	    	<div class="dac_settings">
			    <form id ="input" action="/" method="post"> 
			        <label for="input">Input :</label>
			        <input type = "text" name="input" value="${input}" disabled >
			        <button type="submit">Toggle</button><br>
			        <input type = "hidden" name="target_module" value="${module.exports.title}" >
			        <input type = "hidden" name="target_command" value="toggle_input" >
			    </form>
			</div>
			
	    	<div class="dac_filters">
			    <form id ="filter" action="/" method="post"> 
			        <label for="input">Filter :</label>
			        <input type = "text" name="filter" value="${filter}" disabled >
			        <button type="submit">Toggle</button><br>
			        <input type = "hidden" name="target_module" value="${module.exports.title}" >
			        <input type = "hidden" name="target_command" value="next_filter" >
			    </form>
			</div>
			
			
		</div>
		

	</div>
		    
    
    
    <script>
		(function(){})()
    </script>
`
}

exports.toggle_input = function(data,callback){   
	cp.exec("apessq2m toggle_input",(err,out)=>{
		if(err){
			module_alert = "error : cannot toggle DAC input " + err;
			return;
		}
		try{
			input = out.match(/(?<=Item0:.*?').*?(?=')/)[0];
		}
		catch(e){
			input = "?";
			callback("Something is wrong with DAC configuration, reboot is advised");
			return;
		}
		callback("DAC input is now : " + input);
	})
}

exports.next_filter = function(data,callback){   
	cp.exec("apessq2m next_filter",(err,out)=>{
		
		
		out = out.toString();
		
		if(err){
			module_alert = "error : cannot toggle DAC filter " + err;
			return;
		}
		try{
			filter = out;
		}
		catch(e){
			filter = "?";
			callback("Something is wrong with DAC configuration, reboot is advised");
			return;
		}
		callback("DAC filter is now : " + filter);
	})
}


// helpers --------------------------------


function read_config(){
	
	cp.exec("apessq2m get_input",(err,out)=>{
		if(err){
			module_alert = "error : cannot read DAC input " + err;
			return;
		}
		input = out.replace(/'/g,"");
	})	
	
	cp.exec("apessq2m get_filter",(err,out)=>{
		if(err){
			module_alert = "error : cannot read DAC filter " + err;
			return;
		}
		filter = out;
	})
	
	
	
}



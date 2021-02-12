const http = require("http");
const title = "Evo Sabre";
const fs = require("fs");
const MODULE_PATH = "./ap_modules";
const MAX_POST_BODY_LENGTH = 5000;
const _MODULES = {};

fs.readdir(MODULE_PATH,(err,data)=>{import_modules(err,data,start_server)});

function start_server(){
    http.createServer(server).listen(4150);
};

function server(req,res){
	if (req.method === 'POST'){
        let postdata = ""; 
		req.on('data', (data) =>{ 
			if(data.length < MAX_POST_BODY_LENGTH && data.length + postdata.length < MAX_POST_BODY_LENGTH){	
				postdata+=(data);
			} 
			else{
				req.pause();
				res.status = 500;
				res.end("Error : post too long.");
				req.destroy();
			}
		})
		req.on('end', () =>{		
          
			let parsed = {};
            try{parsed = JSON.parse(postdata)}
            catch(e){
                data = postdata.toString().split('&');
                for(p of data){
                    pp = p.split("=");
                    parsed[pp[0]] = pp[1];
                };
            }
            if( parsed.target_module && _MODULES[parsed.target_module] && typeof _MODULES[parsed.target_module]["handle_post"] === "function"){
                _MODULES[parsed.target_module]["handle_post"](parsed, (module_response)=>{ 
                    _MODULES[parsed.target_module].module_response = module_response
                    if(parsed["response_type"] != "JSON"){
                        res.end(make_page())
                    }
                    else res.end(JSON.stringify(module_response))
                })
                  
            }
		})
	}
	else{
		res.writeHead(200, {"Content-Type": "text/html"});
		res.end(make_page());
	}
}

function make_page(){
    
    
    let _MODULES_HTML = "";
    for(let i in _MODULES){
        try{
			
            _MODULES_HTML += `<section class="module_section" id="${_MODULES[i].title}">
			${_MODULES[i].module_head ? _MODULES[i].module_head: ""}
			
            <div class="module_response">${_MODULES[i].module_response}</div>
            ${_MODULES[i].make_html()}</section>`
            _MODULES[i].module_response = "";
        }
        catch(e){}
        
    }
    
	let html = `
<html>
	<head>
        <style>
            /* NORMALIZE CSS */
            html {
              line-height: 1.15; /* 1 */
              -webkit-text-size-adjust: 100%; /* 2 */
            }
            body {
              margin: 0;
            }
            main {
              display: block;
            }
            h1 {
              font-size: 2em;
              margin: 0;
            }
            h2 {
                font-size: 1.8em;
                margin: 0;
            }
            h3 {
                font-size: 1.6em;
                margin: 0;
            }
            hr {
              box-sizing: content-box; /* 1 */
              height: 0; /* 1 */
              overflow: visible; /* 2 */
            }
            pre {
              font-family: monospace, monospace; /* 1 */
              font-size: 1em; /* 2 */
            }
            a {
              background-color: transparent;
            }
            abbr[title] {
              border-bottom: none; /* 1 */
              text-decoration: underline; /* 2 */
              text-decoration: underline dotted; /* 2 */
            }
            b,strong {
              font-weight: bolder;
            }
            code, kbd, samp {
              font-family: monospace, monospace; /* 1 */
              font-size: 1em; /* 2 */
            }
            small {
              font-size: 80%;
            }
            sub,sup {
              font-size: 75%;
              line-height: 0;
              position: relative;
              vertical-align: baseline;
            }
            sub {
              bottom: -0.25em;
            }
            sup {
              top: -0.5em;
            }
            img {
              border-style: none;
            }
            button, input, optgroup, select, textarea {
              font-family: inherit; /* 1 */
              font-size: 100%; /* 1 */
              line-height: 1.15; /* 1 */
              margin: 0; /* 2 */
            }
            button, input { /* 1 */
              overflow: visible;
            }
            button, select { /* 1 */
              text-transform: none;
            }
            button, [type="button"], [type="reset"], [type="submit"] {
              -webkit-appearance: button;
            }
            button::-moz-focus-inner, [type="button"]::-moz-focus-inner, [type="reset"]::-moz-focus-inner, [type="submit"]::-moz-focus-inner {
              border-style: none;
              padding: 0;
            }
            button:-moz-focusring, [type="button"]:-moz-focusring, [type="reset"]:-moz-focusring, [type="submit"]:-moz-focusring {
              outline: 1px dotted ButtonText;
            }
            fieldset {
              padding: 0.35em 0.75em 0.625em;
            }
            legend {
              box-sizing: border-box; /* 1 */
              color: inherit; /* 2 */
              display: table; /* 1 */
              max-width: 100%; /* 1 */
              padding: 0; /* 3 */
              white-space: normal; /* 1 */
            }
            progress {
              vertical-align: baseline;
            }
            textarea {
              overflow: auto;
            }
            [type="checkbox"], [type="radio"] {
              box-sizing: border-box; /* 1 */
              padding: 0; /* 2 */
            }
            [type="number"]::-webkit-inner-spin-button, [type="number"]::-webkit-outer-spin-button {
              height: auto;
            }
            [type="search"] {
              -webkit-appearance: textfield; /* 1 */
              outline-offset: -2px; /* 2 */
            }
            [type="search"]::-webkit-search-decoration {
              -webkit-appearance: none;
            }
            ::-webkit-file-upload-button {
              -webkit-appearance: button; /* 1 */
              font: inherit; /* 2 */
            }
            details {
              display: block;
            }
            summary {
              display: list-item;
            }
            template {
              display: none;
            }
            [hidden] {
              display: none;
            }

            /* GENERAL */
            body{
                font-family: sans-serif; 
            }

            .content_wrap{
                padding: 10px 5px;
            }

            section{
                width: 100vw;
            }

            label{
              font-weight: 600;
            }

            input[type="number"], select{
              padding: 10px;
              background: #eeeeee;
              border: 0;
            }

            .ok_btn{
              padding: 15px 30px;
              background: #58af22;
              border: 0;
              border-radius: 2px;
              color: #ffffff;
              font-weight: 600;
            }

            .alt_btn{
              padding: 15px 30px;
              background: #676767;
              border: 0;
              border-radius: 2px;
              color: #ffffff;
              font-weight: 600;
            }

            /* HEADER */
            header{
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
                width: 100vw;
                padding: 15px 10px;
                margin-bottom: 4vh;
                background: #212121;
                color: #ffffff;
            }

            header .logo_ap{

            }

            header h1{
                font-family: helvetica, sans-serif;
                text-align: center;
                font-size: 1.8rem;
            }

            /* TOP TITLE */
            .content_name{
                text-align: center;
                margin-bottom: 40px;
            }

            .content_name p{
                color: #888888;
            }

            .content_name:after{
                content: "";
                height: 2px;
                background: #444;
                width: 50px;
                display: inline-block;
            }

            /* TIMEZONE */
            #tz{
              display: flex;
              flex-flow: row wrap;
              justify-content: center;
              align-items: center;
            }

            #tz label{
              margin-right: 10px;
            }

            #tz select:first-of-type{
              margin-right: 50px;
            }


            /* SCREEN - LOGO */
            .oled_wrap{
              margin-bottom: 30px;
            }

            .oled_settings{
              display: flex;
              flex-flow: row wrap;
            }

            .oled_settings form{
              display: flex;
              flex-flow: row wrap;
              justify-content: center;
              flex-grow: 1;
              align-items: center;
              margin: 5px 10px;
            }

            .oled_settings form label{
              margin-right: 10px;
            }

            .oled_settings form input{
              flex-grow: 2;
            }

            .oled_settings button{
              padding: 10px;
              border-radius: 2px;
              border: 0;
              background: #1aa1af;
              color: #ffffff;
              font-weight: 600;
              flex-grow: 1;
            }

            .oled_restart{
              text-align: center;
            }

            .oled_restart button{
              width: 50vw;
              margin-top: 30px;
            }

            /* LOGO */
            .logo_settings{
              text-align: center;
            }

            .logo_settings h3{
              margin-bottom: 15px;
            }

            .logo_settings canvas{
              margin-bottom: 15px;
            }

            .logo_size{
              display: flex;
              flex-flow: row wrap;
              justify-content: center;
            }

            .logo_setting{
              margin: 5px 10px;
            }

        </style> 
    </head>
	<body>
        <header>
            <div class="ap_logo">
                <img src="" alt="Logo Audiophonics">
            </div>
            <h1>${title}</h1>
        </header>
        <div class="content_wrap">
           
            <div id = "modules">${_MODULES_HTML}</div>
        </div>
    </body>
</html>`;

	return(html);
}

function import_modules(err,data,callback){
    if(err) {
        console.warn("Error : cannot open ap_module directory (pointed at)",MODULE_PATH,err)
        return
    }
    
    let todo_list = 0;    
    if (data.length){
        for(let i in data){  
            todo_list ++
            fs.readdir(MODULE_PATH+"/"+data[i],(err,pdata)=>{import_module(err,pdata,data[i])})
        }
    }
    else if (typeof callback === "function") callback();
    
    function import_module(err,data,current_module){
        todo_list --
        if(err || !data.includes("index.js") ) {
            console.warn("Error : cannot open module",current_module,err)
            return;
        }
        let mod = require(MODULE_PATH+"/"+current_module+"/"+"index.js");
        mod.title = current_module;                
        mod.handle_post = handle_post;
        mod.module_response = "";
        _MODULES[current_module] = mod;    
        if(todo_list === 0 && typeof callback === "function" ){callback()}
    }
    
    function handle_post(data,callback){
        if(!data["target_command"]) callback("error : no command specified");
        else if(typeof this[data["target_command"]] !== "function" ) callback("error : command does not exist in module " + this.title);
        else{
            try{
               this[data["target_command"]](data,callback);
            }
            catch(e){
                callback("Error, module command returned error : " + e)
            }
        }
    }
}




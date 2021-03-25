const http = require("http");
const title = "RaspDac Mini OLED";
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
        <link rel="icon" href="data:;base64,iVBORw0KGgo=">

    </head>
	<body>
        <header>
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




// Restart Wizard
const fs = require('fs');
const path = "/data/configuration/system_controller/system/config.json";


fs.readFile(path,handle);

function handle(rerr,data){
	if(rerr){
		console.warn("ERROR READING CONFIG FILE :", path,"\n\t", rerr);
		return
	}
	try{
		let pdata = JSON.parse(data);
		pdata.show_wizard = {
			"type": "boolean",
			"value": true
		  }

		fs.writeFile(path, JSON.stringify(pdata), (werr) => {
		  if (werr) throw err;
		  console.log('Volumio Web interface wizard (re)enabled.');
		});
	}
	catch(e){
		console.warn("ERROR WRITING INTO CONFIG FILE :", path,"\n\t", e);

	}
}
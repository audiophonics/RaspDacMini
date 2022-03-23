#!/bin/sh
target_distribution="$1"
if [ "$target_distribution" = "" ]
then 
    read -p "Select the target distribution : moode, volumio, picoreplayer " target_distribution
    case $target_distribution in
        moode|volumio|picoreplayer) 
			echo $target_distribution 
			break	;;
       * ) 
		   echo $target_distribution is not a valid choice 
		   exit 1 ;;
    esac
fi


current_folder=`pwd`
temp_folder='/tmp/temprdmoledbuild'

nodebin=`which node`
if [ "$nodebin" = "" ]
then 
	echo "node not installed..."
	cd "$current_folder"/../nodebin
	sh install.sh $1
fi
 cd 
nodebin=`which node`
if [ "$nodebin" = "" ]
then 
echo "Error : could not install nodejs to build deps" 
exit 1
else echo "nodejs found OK"
fi


rm -r "$temp_folder" > /dev/null 2>&1
mkdir -p $temp_folder
cd "$current_folder"
cp -rL ./ $temp_folder/


cd "$temp_folder"/modules/basicfonts
npm install

cd "$temp_folder"/modules/lightbwgraphics
npm install "$temp_folder"/modules/basicfonts
cd $temp_folder

cd "$temp_folder"/modules/ssd1306
npm install

cd "$temp_folder"/raspdacminioled
npm install date-and-time "$temp_folder"/modules/lightbwgraphics "$temp_folder"/modules/ssd1306 



case "$target_distribution" in 
'volumio')
	echo configuring directory tree for volumio
	cd "$temp_folder"/raspdacminioled
	npm install socket.io-client@2.1.1 
	cd "$temp_folder"
	
	printf "
#!/bin/sh
mkdir -p /usr/local/etc/
tar -xvzf rdmoled.tar.gz -C /usr/local/etc/
ln -s /usr/local/etc/raspdacminioled/rdmoled.sh /usr/local/bin/rdmoled
chmod +x /usr/local/bin/rdmoled
printf \"[Unit]
Description=OLED Display Service
After=volumio.service
[Service]
WorkingDirectory=/usr/local/etc/raspdacminioled/
ExecStart=\`which sudo\` \`which node\` /usr/local/etc/raspdacminioled/index.js volumio
StandardOutput=null
KillSignal=SIGINT
Type=simple
User=root
[Install]
WantedBy=multi-user.target\"> /etc/systemd/system/oled.service 
systemctl daemon-reload
systemctl enable oled	
systemctl restart oled	
	" > installrdm_oled.sh
	
	tar -cvhzf rdmoled.tar.gz raspdacminioled 
	tar -cvhf rdmoled.tar rdmoled.tar.gz installrdm_oled.sh
	mkdir -p $current_folder/release 
	mv rdmoled.tar $current_folder/release/rdm_"$target_distribution"_oled.tar
;;


'moode')

	cd "$temp_folder"/raspdacminioled
	npm install "$temp_folder"/modules/moodelistener 
	cd "$temp_folder"
	
	echo configuring directory tree for moode
	printf "
#!/bin/sh
apt update -y
apt install --no-install-recommends -y nodejs npm jq
mkdir -p /usr/local/etc/
tar -xvzf rdmoled.tar.gz -C /usr/local/etc/
ln -s /usr/local/etc/raspdacminioled/rdmoled.sh /usr/local/bin/rdmoled
chmod +x /usr/local/bin/rdmoled
printf \"[Unit]
Description=OLED Display Service
After=mpd.service
Requires=mpd.service
[Service]
WorkingDirectory=/usr/local/etc/raspdacminioled/
ExecStart=\`which sudo\` \`which node\` /usr/local/etc/raspdacminioled/index.js moode
StandardOutput=null
KillSignal=SIGINT
Type=simple
User=root
[Install]
WantedBy=multi-user.target\"> /etc/systemd/system/oled.service 
systemctl daemon-reload
systemctl enable oled	
systemctl restart oled	
	" > installrdm_oled.sh
	
	tar -cvhzf rdmoled.tar.gz raspdacminioled 
	tar -cvhf rdmoled.tar rdmoled.tar.gz installrdm_oled.sh
	mkdir -p $current_folder/release 
	mv rdmoled.tar $current_folder/release/rdm_"$target_distribution"_oled.tar
	
;;
'picore')

	echo configuring directory tree for piCorePlayer
	tce-load -wi git.tcz compiletc.tcz python3.8.tcz python3.8-pip.tcz
	cd "$temp_folder"/raspdacminioled
	npm install "$temp_folder"/modules/logitechmediaserver 
	cd "$temp_folder"
	
	
	# build a tcz on the fly for all the oled routines
	mkdir -p "$temp_folder"/release/usr/local/etc/
	cp -rL "$temp_folder"/raspdacminioled "$temp_folder"/release/usr/local/etc/
	printf "
	#!/bin/sh
	cd /usr/local/etc/raspdacminioled
	sudo node /usr/local/etc/raspdacminioled/index.js lms &
	exit 0
	"> "$temp_folder"/release/onload.sh	
	
	echo "node.tcz"> "$temp_folder"/release/dependencies.txt
	sh "$current_folder"/../nodebin/build_tcz.sh rdmoled release
	
	# provide a script for automatic installation
	printf "
	#!/bin/sh
	tce-load -wic gcc_libs
	tce-load -ic node.tcz rdmoled.tcz
	"> "$temp_folder"/installrdm_oled.sh
	
	
	mkdir -p $current_folder/release 
	cp "$current_folder"/../nodebin/release/node.tcz node.tcz
	tar -cvf rdm_"$target_distribution"_oled.tar rdmoled.tcz rdmoled.tcz.md5.txt rdmoled.tcz.dep node.tcz installrdm_oled.sh
	
	cp rdm_"$target_distribution"_oled.tar $current_folder/release 
	
;;
esac 



cd $current_folder
rm -r "$temp_folder"

#!bin/bash


start_time="$(date +"%T")"
echo "* Installing : Evo Sabre OLED#2"
echo "" > install_log.txt

# ---------------------------------------------------
# Installing nodejs if needed and deps
echo "installing nodejs env and dependencies"
apt-get install -y nodejs npm					 > /dev/null 2>> install_log.txt
sudo -u pi npm install pi-spi  					 > /dev/null 2>> install_log.txt
sudo -u pi npm install async  					 > /dev/null 2>> install_log.txt
sudo -u pi npm install onoff  					 > /dev/null 2>> install_log.txt
sudo -u pi npm install date-and-time 			 > /dev/null 2>> install_log.txt
sudo -u pi npm install socket.io-client 		 > /dev/null 2>> install_log.txt

# ---------------------------------------------------
# Enable spi-dev module to allow hardware interfacing
if ! grep -q spi-dev "/etc/modules"; then
	echo "spi-dev" >> /etc/modules
fi
if ! grep -q dtparam=spi=on "/boot/config.txt"; then
	echo "dtparam=spi=on"  >> /boot/config.txt
fi
if  ! grep -q bufsiz=8192 "/etc/modprobe.d/spidev.conf";  then
	echo "options spidev bufsiz=8192"  >> /etc/modprobe.d/spidev.conf 
fi


# ---------------------------------------------------
# Register & enable service so display will run at boot
printf "[Unit]
Description=OLED Display Service
After=mpd.service
Requires=mpd.service

[Service]
WorkingDirectory=${PWD}
ExecStart=/bin/node ${PWD}/index.js
StandardOutput=null
KillSignal=SIGINT
Type=simple
Restart=always
User=pi

[Install]
WantedBy=multi-user.target"> /etc/systemd/system/oled.service &&
systemctl enable oled	> /dev/null 2>> install_log.txt	&&
echo "OLED service enabled ( /etc/systemd/system/oled.service )"

if lsmod | grep "spidev" &> /dev/null ; then
  systemctl start oled
  echo "Display should turn on."
  echo "*End of installation : Evo Sabre OLED#2 (spidev module is already loaded, so no reboot is required)"
  
else
  echo "*End of installation : Evo Sabre OLED#2 (spidev module is NOT loaded : a reboot is required)"
fi

echo started at $start_time finished at "$(date +"%T")" >> install_log.txt
exit 0
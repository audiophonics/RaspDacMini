#!bin/bash



install_dep_volumio() {
   if dpkg -s build-essential &>/dev/null ; then
	echo "Build-essential package is installed."
		else
		echo "Build-essential package missing : installing ..."
		apt-get update > /dev/null 2>> install_log.txt	&&
		apt-get install build-essential  > /dev/null 2>> install_log.txt && 
		echo "... OK" && return true||
		printf "Fail, this version of Volumio lacks some dependencies for software compilation.\nTrying to workaround using this technique : https://community.volumio.org/t/cannot-install-build-essential-package/46856/16 ..." &&
		bash Workaround_BuildEssentials.sh  > /dev/null 2>> install_log.txt && 
		echo "... OK" ||  
		echo "... Failed again. The OLED display will not be installed." &&
		exit 1
	fi
}



start_time="$(date +"%T")"
echo "* Installing : RaspDacMini Oled Display"
echo "" > install_log.txt

install_dep_volumio

sudo -u volumio npm install pi-spi  				 > /dev/null 2>> install_log.txt
sudo -u volumio npm install async  					 > /dev/null 2>> install_log.txt
sudo -u volumio npm install onoff  					 > /dev/null 2>> install_log.txt
sudo -u volumio npm install date-and-time 			 > /dev/null 2>> install_log.txt
sudo -u volumio npm install socket.io-client@2.1.1 	 > /dev/null 2>> install_log.txt
echo "over"
# ---------------------------------------------------
# Enable spi-dev module to allow hardware interfacing
if ! grep -q spi-dev "/etc/modules"; then
	echo "spi-dev" >> /etc/modules
fi
if ! grep -q dtparam=spi=on "/boot/userconfig.txt"; then
	echo "dtparam=spi=on"  >> /boot/userconfig.txt
fi

# ---------------------------------------------------
# Register & enable service so display will run at boot
printf "[Unit]
Description=OLED Display Service
After=volumio.service
[Service]
WorkingDirectory=${PWD}
ExecStart=/bin/node ${PWD}/index.js
StandardOutput=null
Type=simple
Restart=always
KillSignal=SIGINT
User=volumio
[Install]
WantedBy=multi-user.target"> /etc/systemd/system/oled.service &&
systemctl enable oled	> /dev/null 2>> install_log.txt	&&
echo "OLED service enabled ( /etc/systemd/system/oled.service )"

if lsmod | grep "spidev" &> /dev/null ; then
  systemctl start oled
  echo "Display should turn on."
  echo "*End of installation : RaspDacMini Oled Display (spidev module is already loaded, so no reboot is required)"
  
else
  echo "*End of installation : RaspDacMini Oled Display (spidev module is NOT loaded : a reboot is required)"
fi

echo started at $start_time finished at "$(date +"%T")" >> install_log.txt
exit 0

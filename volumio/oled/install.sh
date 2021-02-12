#!/bin/bash
start_time="$(date +"%T")"

# ---------------------------------------------------
# Install C dependencies 
if grep -q jessie "/etc/os-release"; then # If OS is raspbian jessie (volumio) tell apt-get to hit jessie backports repo (default jessie libssl does not allow pip to work properly)
		bash -c "printf 'deb http://archive.debian.org/debian/ jessie-backports main contrib non-free\ndeb-src http://archive.debian.org/debian/ jessie-backports main contrib non-free' >> /etc/apt/sources.list" 
		bash -c "echo 'Acquire::Check-Valid-Until no;' > /etc/apt/apt.conf.d/99no-check-valid-until" 
		apt-get update 
		apt-get install -y --force-yes -t jessie-backports libssl-dev=1.0.2l-1~bpo8+1 
	else   # If not, default version of libssl should work fine 
		apt-get update 
		apt-get -y install libssl-dev
fi
apt-get -y install build-essential zlib1g-dev libncurses5-dev libgdbm-dev libnss3-dev libreadline-dev libffi-dev libfreetype6-dev libjpeg-dev wget

# ---------------------------------------------------
# download & install python 3.9 from source 

wget https://www.python.org/ftp/python/3.9.0/Python-3.9.0.tgz 
tar xvf Python-3.9.0.tgz 
cd Python-3.9.0 
./configure --enable-optimizations --with-ensurepip=install &&
make -j 8 &&
make altinstall &&
cd ..
rm -r Python-3.9.0 Python-3.9.0.tgz 

# ---------------------------------------------------
# Create & enter python virtual environment
python3.9 -m venv "${PWD}"
source bin/activate

# ---------------------------------------------------
# Install python dependencies in venv
python3.9 -m pip install --upgrade pip setuptools
python3.9 -m pip install -r requirements.txt
deactivate

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
ExecStart=${PWD}/bin/python3.9 ${PWD}/oled_drive.py
StandardOutput=null
Type=simple
Restart=always
KillSignal=SIGINT
User=volumio
[Install]
WantedBy=multi-user.target"> /etc/systemd/system/oled.service
systemctl enable oled		

# ---------------------------------------------------
# Say something nice and exit
printf "\n\n-----------------------------------------\n"
echo started at $start_time finished at "$(date +"%T")"
echo "You should reboot now. Enjoy your display and have a nice day."

#!/bin/bash

start_time="$(date +"%T")"
echo "* Installing : Evo Sabre OLED#2"
echo "" > install_log.txt
# ---------------------------------------------------
# Install C dependencies 
if grep -q jessie "/etc/os-release"; then # If OS is raspbian jessie (volumio) tell apt-get to hit jessie backports repo (default jessie libssl does not allow pip to work properly)

    if ! apt list libssl-dev 2> /dev/null | grep -q "1.0.2l-1~bpo8+1"; then
        echo "jessie needs backport for libssl-dev, installing..."
		bash -c "printf 'deb http://archive.debian.org/debian/ jessie-backports main contrib non-free\ndeb-src http://archive.debian.org/debian/ jessie-backports main contrib non-free' >> /etc/apt/sources.list" 
		bash -c "echo 'Acquire::Check-Valid-Until no;' > /etc/apt/apt.conf.d/99no-check-valid-until" 
		apt-get update > /dev/null 2>> install_log.txt
		apt-get install -y --force-yes -t jessie-backports libssl-dev=1.0.2l-1~bpo8+1 > /dev/null 2>> install_log.txt
        else    
        echo "libssl-dev right version installed for jessie"
    fi    
        
	else   # If not, default version of libssl should work fine 
		apt-get update > /dev/null 2>> install_log.txt
		apt-get -y install libssl-dev > /dev/null 2>> install_log.txt
fi
apt-get -y install build-essential zlib1g-dev libncurses5-dev libgdbm-dev libnss3-dev libreadline-dev libffi-dev libfreetype6-dev libjpeg-dev wget > /dev/null 2>> install_log.txt

# ---------------------------------------------------
# download & install python 3.9 from source 

if ! which python3.9 | grep -q python3.9; then
    echo "Building python from source"
    echo "This part can take a while (more than 30mn on a PI 4)"
    wget https://www.python.org/ftp/python/3.9.0/Python-3.9.0.tgz > /dev/null 2>> install_log.txt &&
    tar xvf Python-3.9.0.tgz > /dev/null 2>> install_log.txt &&
    cd Python-3.9.0 &&
    ./configure --enable-optimizations --with-ensurepip=install > /dev/null 2>> install_log.txt &&
    make -j 8 > /dev/null 2>> install_log.txt  &&
    make altinstall > /dev/null 2>> install_log.txt &&
    cd .. &&
    rm -r Python-3.9.0 Python-3.9.0.tgz &&
    echo "Longest part is over" || echo "failed to build python"
    
    else
        echo "python3.9 already installed"
fi    

# ---------------------------------------------------
# Create & enter python virtual environment
echo "installing python env and dependencies"

python3.9 -m venv "${PWD}" &&
source bin/activate &&

# ---------------------------------------------------
# Install python dependencies in venv
python3.9 -m pip install --upgrade pip setuptools > /dev/null 2>> install_log.txt &&
python3.9 -m pip install -r requirements.txt > /dev/null 2>> install_log.txt &&
echo "Python modules have been configured" || echo "Error configuring python modules"
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
ExecStart=${PWD}/bin/python3.9 ${PWD}/oled.py
StandardOutput=null
Type=simple
Restart=always
KillSignal=SIGINT
User=volumio
[Install]
WantedBy=multi-user.target"> /etc/systemd/system/oled.service &&
systemctl enable oled	> /dev/null 2>> install_log.txt	&&
echo "OLED#2 service enabled ( /etc/systemd/system/oled.service )"

# ---------------------------------------------------
# Say something nice and exit
echo "* End of installation : Evo Sabre OLED#2 - reboot required"
echo started at $start_time finished at "$(date +"%T")" >> install_log.txt
exit 0
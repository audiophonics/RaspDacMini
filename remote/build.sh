#!/bin/sh
target_distribution="$1"
current_folder=`pwd`
temp_folder='/tmp/temprdmremotebuild'

rm -r "$temp_folder" > /dev/null 2>&1
mkdir -p $temp_folder
cp -rL ./ $temp_folder/
cd $temp_folder

case "$target_distribution" in 
volumio|moode)
printf "#!/bin/bash

# ---------------------------------------------------
# Install dependencies 
apt-get update
apt-get install --no-install-recommends -y lirc

# ---------------------------------------------------
# Enable gpio-ir driver to allow hardware interfacing
if ! grep -q \"dtoverlay=gpio-ir,gpio_pin=4\" \"/boot/userconfig.txt\"; then
    echo \"dtoverlay=gpio-ir,gpio_pin=4\"  >> /boot/userconfig.txt
fi

# ---------------------------------------------------
# push config
tar -xvzf rdmremote.tar.gz -C /etc/

# ---------------------------------------------------
# enable service

systemctl daemon-reload
systemctl enable lircd
systemctl restart lircd
systemctl enable irexec
systemctl restart irexec

exit 0
" > installrdm_remote.sh

cp -r config/"$target_distribution"/lirc ./lirc
tar -cvhzf rdmremote.tar.gz ./lirc
tar -cvf rdmremote.tar installrdm_remote.sh rdmremote.tar.gz
mkdir -p $current_folder/release 
mv rdmremote.tar $current_folder/release/rdm_"$target_distribution"_remote.tar 



;;
'moode')

;;
'picore')

;;
esac 

cd $current_folder
rm -r "$temp_folder"
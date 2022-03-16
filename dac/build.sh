#!/bin/sh 
target_distribution="$1"
current_folder=`pwd`
temp_folder='/tmp/temprdmdacbuild'

rm -r "$temp_folder" > /dev/null 2>&1
mkdir -p $temp_folder
cp -rL ./ $temp_folder/
cd $temp_folder

case "$target_distribution" in 
volumio)
mkdir -p config
cp /data/configuration/audio_interface/alsa_controller/config.json config/alsa_controller.json
cp /data/configuration/system_controller/i2s_dacs/config.json config/i2s_dacs.json
cp /data/configuration/music_service/mpd/config.json config/mpd.json

chmod +xX apessq2m
printf "#!/bin/sh
tar -xvzf rdmdac.tar.gz -C /usr/local/bin/
chmod +xX /usr/local/bin/apessq2m
node volumio_autoconf
exit 0
" > installrdm_dac.sh
tar -cvhzf rdmdac.tar.gz apessq2m 
tar -cvf rdmdac.tar installrdm_dac.sh rdmdac.tar.gz volumio_autoconf
mkdir -p $current_folder/release 
mv rdmdac.tar $current_folder/release/rdm_"$target_distribution"_dac.tar 
;;

moode)
moodeutl -e rdm_config.ini
chmod +xX apessq2m
printf "#!/bin/sh
cp rdm_config.ini /boot/moodecfg.ini
moodeutl -i
touch /boot/userconfig.txt
sed -i '/include userconfig.txt/d' /boot/config.txt
echo \"include userconfig.txt\" >> /boot/config.txt
tar -xvzf rdmdac.tar.gz -C /usr/local/bin/
chmod +xX /usr/local/bin/apessq2m
exit 0
" > installrdm_dac.sh
tar -cvhzf rdmdac.tar.gz apessq2m
tar -cvf rdmdac.tar installrdm_dac.sh rdmdac.tar.gz rdm_config.ini
mkdir -p $current_folder/release 
mv rdmdac.tar $current_folder/release/rdm_"$target_distribution"_dac.tar 
;;
'picore')

;;
esac 

cd $current_folder
rm -r "$temp_folder"